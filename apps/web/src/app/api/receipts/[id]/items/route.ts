import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { z } from "zod";

const ItemUpdateSchema = z.object({
  id: z.string().uuid(),
  classification: z.enum(["business", "personal", "unclassified"]).optional(),
  expense_type: z.enum(["material", "labour", "overhead"]).optional(),
  labour_type: z.enum(["employee", "subcontractor"]).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  tax_category: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const PatchItemsSchema = z.object({
  items: z.array(ItemUpdateSchema).min(1),
});

/** PATCH /api/receipts/[id]/items — Bulk-update line item classifications */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: receiptId } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Verify receipt belongs to the user's business (prevents IDOR)
  const { data: receipt } = await supabase
    .from("ii_receipts")
    .select("id, business_id")
    .eq("id", receiptId)
    .eq("business_id", businessId)
    .single();

  if (!receipt) {
    return NextResponse.json(
      { error: "Receipt not found" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = PatchItemsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { items } = parsed.data;
  const errors: string[] = [];
  const updates: Array<{
    id: string;
    data: Record<string, unknown>;
  }> = [];

  // Validate project ownership for any project_id assignments
  const projectIds = [
    ...new Set(
      items
        .filter((i) => i.project_id != null && i.project_id !== undefined)
        .map((i) => i.project_id as string)
    ),
  ];
  if (projectIds.length > 0) {
    const { data: ownedProjects } = await supabase
      .from("ii_projects")
      .select("id")
      .in("id", projectIds)
      .eq("business_id", businessId);
    const ownedIds = new Set((ownedProjects ?? []).map((p) => p.id));
    const invalidIds = projectIds.filter((pid) => !ownedIds.has(pid));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "One or more project IDs do not belong to your business" },
        { status: 403 }
      );
    }
  }

  for (const item of items) {
    const data: Record<string, unknown> = {};

    if (item.classification !== undefined) {
      data.classification = item.classification;
      data.classified_at = new Date().toISOString();
      data.classified_by = userId;
    }

    if (item.expense_type !== undefined) {
      data.expense_type = item.expense_type;
      // Clear labour_type when switching away from labour
      if (item.expense_type !== "labour") {
        data.labour_type = null;
      }
    }

    if (item.labour_type !== undefined) {
      data.labour_type = item.labour_type;
    }

    if (item.project_id !== undefined) {
      data.project_id = item.project_id;
    }

    if (item.category !== undefined) {
      data.category = item.category;
    }

    if (item.tax_category !== undefined) {
      data.tax_category = item.tax_category;
    }

    if (item.notes !== undefined) {
      data.notes = item.notes;
    }

    if (Object.keys(data).length > 0) {
      updates.push({ id: item.id, data });
    }
  }

  // Group updates by identical payload to minimize DB round-trips.
  // Common case: user classifies multiple items the same way in bulk.
  const groupedByPayload = new Map<string, { ids: string[]; data: Record<string, unknown> }>();

  for (const { id, data } of updates) {
    const key = JSON.stringify(data);
    const group = groupedByPayload.get(key);
    if (group) {
      group.ids.push(id);
    } else {
      groupedByPayload.set(key, { ids: [id], data });
    }
  }

  // Execute one query per unique payload shape (usually 1-2 queries instead of N)
  const results = await Promise.allSettled(
    Array.from(groupedByPayload.values()).map(({ ids, data }) =>
      supabase
        .from("ii_receipt_items")
        .update(data)
        .in("id", ids)
        .eq("receipt_id", receiptId)
    )
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const group = Array.from(groupedByPayload.values())[i];
    if (result.status === "rejected") {
      console.error(`Failed to update items [${group.ids.join(", ")}]:`, result.reason);
      errors.push(`Failed to update items [${group.ids.join(", ")}]`);
    } else if (result.value.error) {
      console.error(`Failed to update items [${group.ids.join(", ")}]:`, result.value.error.message);
      errors.push(`Failed to update items [${group.ids.join(", ")}]`);
    }
  }

  // Update receipt-level flags based on item classifications
  const { data: allItems } = await supabase
    .from("ii_receipt_items")
    .select("classification")
    .eq("receipt_id", receiptId);

  if (allItems) {
    const classifications = allItems.map((i) => i.classification);
    const hasBusiness = classifications.includes("business");
    const hasPersonal = classifications.includes("personal");
    const hasUnclassified = classifications.includes("unclassified");

    const receiptUpdates: Record<string, unknown> = {
      has_business_items: hasBusiness,
      has_personal_items: hasPersonal,
      has_unclassified_items: hasUnclassified,
    };

    // Auto-complete: if all items classified and receipt is in_review, mark complete
    if (!hasUnclassified && allItems.length > 0) {
      const { data: currentReceipt } = await supabase
        .from("ii_receipts")
        .select("status")
        .eq("id", receiptId)
        .single();

      if (currentReceipt?.status === "in_review") {
        receiptUpdates.status = "complete";
        receiptUpdates.reviewed_at = new Date().toISOString();
        receiptUpdates.needs_review = false;
      }
    }

    await supabase
      .from("ii_receipts")
      .update(receiptUpdates)
      .eq("id", receiptId);
  }

  // Fetch updated items and receipt
  const [{ data: updatedItems }, { data: updatedReceipt }] = await Promise.all([
    supabase
      .from("ii_receipt_items")
      .select("*")
      .eq("receipt_id", receiptId)
      .order("created_at"),
    supabase
      .from("ii_receipts")
      .select("*")
      .eq("id", receiptId)
      .single(),
  ]);

  return NextResponse.json({
    items: updatedItems,
    receipt: updatedReceipt,
    errors: errors.length > 0 ? errors : undefined,
  });
}
