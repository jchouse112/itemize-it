import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { z } from "zod";

const AddExpenseSchema = z.object({
  name: z.string().min(1).max(500),
  amount_cents: z.number().int().positive(),
  merchant: z.string().max(200).nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  classification: z.enum(["business", "personal", "unclassified"]).default("business"),
  payment_method: z.enum(["cash", "credit_card", "debit_card", "check", "ach", "wire", "other"]).default("cash"),
  notes: z.string().max(2000).nullable().optional(),
});

/**
 * POST /api/projects/[id]/expenses
 * Create a manual expense (receipt + single item) linked to a project.
 * Used for cash payments or lost receipts.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Validate request body
  const body = await request.json();
  const parsed = AddExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, amount_cents, merchant, purchase_date, classification, payment_method, notes } = parsed.data;

  // Verify project exists and belongs to this business
  const { data: project, error: projectError } = await supabase
    .from("ii_projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("business_id", businessId)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  // Get business currency
  const { data: business } = await supabase
    .from("businesses")
    .select("default_currency")
    .eq("id", businessId)
    .single();

  const currency = business?.default_currency ?? "USD";

  // Create the receipt (header) for this manual expense
  const { data: receipt, error: receiptError } = await supabase
    .from("ii_receipts")
    .insert({
      business_id: businessId,
      user_id: userId,
      merchant: merchant || "Manual Entry",
      purchase_date: purchase_date || null,
      total_cents: amount_cents,
      subtotal_cents: amount_cents,
      tax_cents: 0,
      currency,
      payment_method,
      payment_source: classification === "business" ? "business_funds" : "personal_funds",
      status: "complete",
      is_manually_edited: true,
      project_id: projectId,
      has_business_items: classification === "business",
      has_personal_items: classification === "personal",
      has_unclassified_items: classification === "unclassified",
      needs_review: false,
    })
    .select("id")
    .single();

  if (receiptError || !receipt) {
    console.error("Failed to create receipt:", receiptError?.message);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }

  // Create the line item
  const now = new Date().toISOString();
  const { data: item, error: itemError } = await supabase
    .from("ii_receipt_items")
    .insert({
      receipt_id: receipt.id,
      business_id: businessId,
      user_id: userId,
      name,
      description: notes || null,
      quantity: 1,
      total_price_cents: amount_cents,
      subtotal_cents: amount_cents,
      tax_cents: 0,
      classification,
      classified_at: classification !== "unclassified" ? now : null,
      classified_by: classification !== "unclassified" ? userId : null,
      project_id: projectId,
      notes: notes || null,
    })
    .select("*")
    .single();

  if (itemError || !item) {
    console.error("Failed to create item:", itemError?.message);
    // Try to clean up the orphaned receipt
    await supabase.from("ii_receipts").delete().eq("id", receipt.id);
    return NextResponse.json(
      { error: "Failed to create expense item" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    receipt_id: receipt.id,
    item_id: item.id,
    message: "Expense added successfully",
  });
}

