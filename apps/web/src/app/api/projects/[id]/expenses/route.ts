import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { z } from "zod";

const AllocationSchema = z.object({
  project_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
});

const AddExpenseSchema = z.object({
  name: z.string().min(1).max(500),
  amount_cents: z.number().int().positive(),
  merchant: z.string().max(200).nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  classification: z.enum(["business", "personal", "unclassified"]).default("business"),
  expense_type: z.enum(["material", "labour", "overhead"]).optional(),
  labour_type: z.enum(["employee", "subcontractor"]).nullable().optional(),
  payment_method: z.enum(["cash", "credit_card", "debit_card", "check", "ach", "wire", "other"]).default("cash"),
  notes: z.string().max(2000).nullable().optional(),
  /** Optional multi-project allocation. When provided, amounts must sum to amount_cents. */
  allocations: z.array(AllocationSchema).min(2).max(10).optional(),
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

  const { name, amount_cents, merchant, purchase_date, classification, expense_type, labour_type, payment_method, notes, allocations } = parsed.data;

  // Validate allocations sum to total when provided
  if (allocations) {
    const allocSum = allocations.reduce((s, a) => s + a.amount_cents, 0);
    if (allocSum !== amount_cents) {
      return NextResponse.json(
        { error: `Allocation amounts must sum to ${amount_cents} cents. Got ${allocSum}.` },
        { status: 400 }
      );
    }
  }

  // Verify the URL project exists and belongs to this business
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

  // Verify all allocation project IDs belong to this business
  if (allocations) {
    const allProjectIds = [...new Set(allocations.map((a) => a.project_id))];
    const { data: ownedProjects } = await supabase
      .from("ii_projects")
      .select("id")
      .in("id", allProjectIds)
      .eq("business_id", businessId);
    const ownedIds = new Set((ownedProjects ?? []).map((p) => p.id));
    const invalid = allProjectIds.filter((pid) => !ownedIds.has(pid));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "One or more allocation project IDs do not belong to your business" },
        { status: 403 }
      );
    }
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

  // Create line item(s)
  const now = new Date().toISOString();
  const resolvedExpenseType = classification === "business" ? (expense_type ?? "material") : "material";
  const resolvedLabourType = expense_type === "labour" ? (labour_type ?? null) : null;

  const itemRows = allocations
    ? allocations.map((alloc, i) => ({
        receipt_id: receipt.id,
        business_id: businessId,
        user_id: userId,
        name: allocations.length > 1 ? `${name} (${i + 1}/${allocations.length})` : name,
        description: notes || null,
        quantity: 1,
        total_price_cents: alloc.amount_cents,
        subtotal_cents: alloc.amount_cents,
        tax_cents: 0,
        classification,
        expense_type: resolvedExpenseType,
        labour_type: resolvedLabourType,
        classified_at: classification !== "unclassified" ? now : null,
        classified_by: classification !== "unclassified" ? userId : null,
        project_id: alloc.project_id,
        notes: notes || null,
      }))
    : [
        {
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
          expense_type: resolvedExpenseType,
          labour_type: resolvedLabourType,
          classified_at: classification !== "unclassified" ? now : null,
          classified_by: classification !== "unclassified" ? userId : null,
          project_id: projectId,
          notes: notes || null,
        },
      ];

  const { data: insertedItems, error: itemError } = await supabase
    .from("ii_receipt_items")
    .insert(itemRows)
    .select("*");

  if (itemError || !insertedItems || insertedItems.length === 0) {
    console.error("Failed to create item(s):", itemError?.message);
    // Try to clean up the orphaned receipt
    await supabase.from("ii_receipts").delete().eq("id", receipt.id);
    return NextResponse.json(
      { error: "Failed to create expense item" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    receipt_id: receipt.id,
    item_ids: insertedItems.map((i) => i.id),
    message: "Expense added successfully",
  });
}

