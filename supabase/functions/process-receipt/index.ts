// Supabase Edge Function: process-receipt
// Trigger: New receipt insertion (via database webhook or direct invocation)
// Logic:
// 1. OCR the image using OpenAI GPT-4o mini
// 2. Extract line items from the receipt
// 3. Check user's active projects for GPS match (Context Awareness)
// 4. Check price history for inflation warnings
// 5. Insert extracted items to receipt_items table

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReceiptItem {
  description: string;
  amount: number;
  category: "material" | "asset" | "personal";
}

interface ProcessReceiptPayload {
  receipt_id: string;
  image_url: string;
  user_lat?: number;
  user_lng?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const payload: ProcessReceiptPayload = await req.json();
    const { receipt_id, image_url, user_lat, user_lng } = payload;

    if (!receipt_id || !image_url) {
      return new Response(
        JSON.stringify({ error: "Missing receipt_id or image_url" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update receipt status to processing
    await supabaseClient
      .from("receipts")
      .update({ scan_status: "processing" })
      .eq("id", receipt_id);

    // Get user_id from receipt for context
    const { data: receipt } = await supabaseClient
      .from("receipts")
      .select("user_id")
      .eq("id", receipt_id)
      .single();

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    const user_id = receipt.user_id;

    // ============================================
    // STEP 1: OCR with OpenAI GPT-4o mini
    // ============================================
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const ocrResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a receipt OCR specialist. Extract line items from receipt images.

              Return a JSON object with:
              {
                "merchant_name": "string",
                "receipt_date": "YYYY-MM-DD or null",
                "total_amount": number,
                "items": [
                  {
                    "description": "item name",
                    "amount": number,
                    "category": "material" | "asset" | "personal"
                  }
                ]
              }

              Category rules:
              - "material": Construction/office supplies, consumables
              - "asset": Equipment, tools, electronics over $50
              - "personal": Food, drinks, personal items

              Only return valid JSON, no markdown.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: image_url },
                },
                {
                  type: "text",
                  text: "Extract all line items from this receipt.",
                },
              ],
            },
          ],
          max_tokens: 1000,
        }),
      }
    );

    const ocrData = await ocrResponse.json();
    const extractedContent = ocrData.choices?.[0]?.message?.content;

    if (!extractedContent) {
      throw new Error("Failed to extract receipt content");
    }

    const parsedReceipt = JSON.parse(extractedContent);

    // Update receipt with extracted merchant and total
    await supabaseClient
      .from("receipts")
      .update({
        merchant_name: parsedReceipt.merchant_name,
        total_amount: parsedReceipt.total_amount,
        receipt_date: parsedReceipt.receipt_date,
      })
      .eq("id", receipt_id);

    // ============================================
    // STEP 2: GPS Context - Match to Projects
    // ============================================
    let matchedProjectId: string | null = null;

    if (user_lat && user_lng) {
      // Find projects within radius of user's location
      const { data: projects } = await supabaseClient
        .from("projects")
        .select("id, name, lat, lng, radius_meters")
        .eq("user_id", user_id)
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (projects && projects.length > 0) {
        // Simple distance calculation (Haversine would be more accurate)
        for (const project of projects) {
          const distance = Math.sqrt(
            Math.pow((project.lat - user_lat) * 111000, 2) +
              Math.pow((project.lng - user_lng) * 111000, 2)
          );

          if (distance <= (project.radius_meters || 100)) {
            matchedProjectId = project.id;
            break;
          }
        }
      }
    }

    // ============================================
    // STEP 3: Check Price History for Inflation
    // ============================================
    const priceWarnings: string[] = [];

    for (const item of parsedReceipt.items) {
      const { data: priceHistory } = await supabaseClient
        .from("price_history")
        .select("amount, recorded_at")
        .eq("user_id", user_id)
        .ilike("item_description", `%${item.description}%`)
        .order("recorded_at", { ascending: false })
        .limit(1);

      if (priceHistory && priceHistory.length > 0) {
        const previousPrice = priceHistory[0].amount;
        const priceIncrease =
          ((item.amount - previousPrice) / previousPrice) * 100;

        if (priceIncrease > 10) {
          priceWarnings.push(
            `${item.description}: +${priceIncrease.toFixed(1)}% from last purchase`
          );
        }
      }

      // Record current price for future reference
      await supabaseClient.from("price_history").insert({
        user_id,
        item_description: item.description,
        merchant_name: parsedReceipt.merchant_name,
        amount: item.amount,
      });
    }

    // ============================================
    // STEP 4: Insert Receipt Items
    // ============================================
    const itemsToInsert = parsedReceipt.items.map((item: ReceiptItem) => ({
      receipt_id,
      description: item.description,
      amount: item.amount,
      category: item.category,
      project_id: item.category !== "personal" ? matchedProjectId : null,
    }));

    await supabaseClient.from("receipt_items").insert(itemsToInsert);

    // Update receipt status to complete
    await supabaseClient
      .from("receipts")
      .update({ scan_status: "complete" })
      .eq("id", receipt_id);

    return new Response(
      JSON.stringify({
        success: true,
        receipt_id,
        items_extracted: parsedReceipt.items.length,
        matched_project_id: matchedProjectId,
        price_warnings: priceWarnings,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing receipt:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
