import { parse } from "csv-parse/sync";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// ── Zod schemas for each CSV type ────────────────────────────
const QuoteHeaderRow = z.object({
  quote_id: z.string().min(1),
  quote_date: z.string(),
  customer_id: z.string().min(1),
  branch_id: z.string().min(1),
  rep_id: z.string().min(1),
  quote_status: z.string().default("open"),
  order_reference: z.string().optional(),
  total_value: z.string().optional(),
  line_count: z.string().optional(),
  multi_option_flag: z.string().optional(),
}).passthrough();

const QuoteLineRow = z.object({
  quote_line_id: z.string().optional(),
  quote_id: z.string().min(1),
  line_number: z.string(),
  sku: z.string().optional(),
  description: z.string().optional(),
  quantity: z.string().optional(),
  unit_price: z.string().optional(),
  ext_price: z.string().optional(),
  option_group: z.string().optional(),
  is_alternate: z.string().optional(),
}).passthrough();

const OrderHeaderRow = z.object({
  order_id: z.string().min(1),
  order_date: z.string(),
  customer_id: z.string().min(1),
  branch_id: z.string().optional(),
  rep_id: z.string().optional(),
  order_type: z.string().default("unknown"),
  invoice_status: z.string().default("open"),
  originating_quote_id: z.string().optional(),
  total_value: z.string().optional(),
}).passthrough();

const OrderLineRow = z.object({
  order_line_id: z.string().optional(),
  order_id: z.string().min(1),
  line_number: z.string(),
  sku: z.string().optional(),
  description: z.string().optional(),
  quantity: z.string().optional(),
  unit_price: z.string().optional(),
  ext_price: z.string().optional(),
}).passthrough();

const CustomerRow = z.object({
  customer_id: z.string().min(1),
  customer_name: z.string().min(1),
  branch_id: z.string().optional(),
  rep_id: z.string().optional(),
  tier: z.enum(["A","B","C"]).default("C"),
  is_repeat: z.string().optional(),
  buys_off_quotes: z.string().optional(),
  ltm_sales: z.string().optional(),
  contact_email: z.string().optional(),
  contact_mobile: z.string().optional(),
  opt_out_flag: z.string().optional(),
  opt_out_channel: z.string().optional(),
  account_type: z.string().optional(),
}).passthrough();

const CreditRow = z.object({
  customer_id: z.string().min(1),
  credit_hold: z.string().optional(),
  credit_standing: z.string().default("good"),
  credit_limit: z.string().optional(),
  current_balance: z.string().optional(),
  days_past_due: z.string().optional(),
  as_of_date: z.string().optional(),
}).passthrough();

// ── Parse helper ──────────────────────────────────────────────
function parseCSV(content: string): Record<string, string>[] {
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

function toBool(v: string | undefined): boolean {
  return v?.toLowerCase() === "true" || v === "1";
}
function toNullableStr(v: string | undefined): string | null {
  return v && v.trim() ? v.trim() : null;
}
function toNullableDate(v: string | undefined): string | null {
  if (!v || !v.trim()) return null;
  return v.trim();
}

// ── Main ingest function ───────────────────────────────────────
export interface IngestFiles {
  quotes_header?: string;    // CSV content
  quotes_lines?: string;
  orders_header?: string;
  orders_lines?: string;
  customers?: string;
  credit?: string;
  bookings?: string;
}

export interface IngestResult {
  batch_id: string;
  file_counts: Record<string, number>;
  coverage_warnings: string[];
  quarantined_rows: Array<{ file: string; row: number; error: string }>;
}

export async function ingest(files: IngestFiles, uploadedBy: string): Promise<IngestResult> {
  const db = getDb();
  const batchId = `batch-${uuidv4()}`;
  const fileCounts: Record<string, number> = {};
  const warnings: string[] = [];
  const quarantined: Array<{ file: string; row: number; error: string }> = [];

  // Create batch record
  await db.insert(schema.ingest_batch).values({
    ingest_batch_id: batchId,
    uploaded_by: uploadedBy,
    status: "pending",
    file_counts: {},
    coverage_warnings: [],
    quarantined_rows: [],
    lists_published: false,
  });

  // ── Customers ──
  if (files.customers) {
    const rows = parseCSV(files.customers);
    fileCounts.customers = rows.length;
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      const parsed = CustomerRow.safeParse(rows[i]);
      if (!parsed.success) {
        quarantined.push({ file: "customers", row: i + 2, error: parsed.error.message });
        continue;
      }
      const r = parsed.data;
      try {
        await db.insert(schema.customer_master).values({
          customer_id: r.customer_id,
          customer_name: r.customer_name,
          branch_id: toNullableStr(r.branch_id),
          rep_id: toNullableStr(r.rep_id),
          tier: r.tier,
          is_repeat: toBool(r.is_repeat),
          buys_off_quotes: r.buys_off_quotes || "0",
          ltm_sales: r.ltm_sales || "0",
          contact_email: toNullableStr(r.contact_email),
          contact_mobile: toNullableStr(r.contact_mobile),
          opt_out_flag: toBool(r.opt_out_flag),
          opt_out_channel: toNullableStr(r.opt_out_channel),
          account_type: r.account_type || "unknown",
        }).onConflictDoNothing();
        ok++;
      } catch (e: any) {
        quarantined.push({ file: "customers", row: i + 2, error: e.message });
      }
    }
    if (ok < rows.length) warnings.push(`customers: ${rows.length - ok} rows quarantined`);
  }

  // ── Credit ──
  if (files.credit) {
    const rows = parseCSV(files.credit);
    fileCounts.credit = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const parsed = CreditRow.safeParse(rows[i]);
      if (!parsed.success) { quarantined.push({ file: "credit", row: i + 2, error: parsed.error.message }); continue; }
      const r = parsed.data;
      try {
        await db.insert(schema.credit_status).values({
          customer_id: r.customer_id,
          credit_hold: toBool(r.credit_hold),
          credit_standing: r.credit_standing,
          credit_limit: r.credit_limit || null,
          current_balance: r.current_balance || null,
          days_past_due: r.days_past_due ? parseInt(r.days_past_due) : 0,
          as_of_date: toNullableDate(r.as_of_date),
          ingest_batch_id: batchId,
        }).onConflictDoUpdate({ target: schema.credit_status.customer_id, set: { credit_hold: toBool(r.credit_hold), credit_standing: r.credit_standing, ingest_batch_id: batchId } });
      } catch (e: any) {
        quarantined.push({ file: "credit", row: i + 2, error: e.message });
      }
    }
  }

  // ── Order headers ──
  if (files.orders_header) {
    const rows = parseCSV(files.orders_header);
    fileCounts.orders_header = rows.length;
    let missingRef = 0;
    for (let i = 0; i < rows.length; i++) {
      const parsed = OrderHeaderRow.safeParse(rows[i]);
      if (!parsed.success) { quarantined.push({ file: "orders_header", row: i + 2, error: parsed.error.message }); continue; }
      const r = parsed.data;
      if (!r.originating_quote_id) missingRef++;
      try {
        await db.insert(schema.order_header).values({
          order_id: r.order_id,
          order_date: toNullableDate(r.order_date),
          customer_id: r.customer_id,
          branch_id: toNullableStr(r.branch_id),
          rep_id: toNullableStr(r.rep_id),
          order_type: r.order_type || "unknown",
          invoice_status: r.invoice_status || "open",
          originating_quote_id: toNullableStr(r.originating_quote_id),
          total_value: r.total_value || null,
          ingest_batch_id: batchId,
        }).onConflictDoNothing();
      } catch (e: any) {
        quarantined.push({ file: "orders_header", row: i + 2, error: e.message });
      }
    }
    if (missingRef > 0) warnings.push(`orders: ${missingRef}/${rows.length} rows missing originating_quote_id — fuzzy-match only for those orders (AC-10)`);
  }

  // ── Order lines ──
  if (files.orders_lines) {
    const rows = parseCSV(files.orders_lines);
    fileCounts.orders_lines = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const parsed = OrderLineRow.safeParse(rows[i]);
      if (!parsed.success) { quarantined.push({ file: "orders_lines", row: i + 2, error: parsed.error.message }); continue; }
      const r = parsed.data;
      try {
        const lineId = r.order_line_id || `${r.order_id}-${r.line_number}`;
        await db.insert(schema.order_line).values({
          order_line_id: lineId,
          order_id: r.order_id,
          line_number: parseInt(r.line_number),
          sku: toNullableStr(r.sku),
          description: toNullableStr(r.description),
          quantity: r.quantity || null,
          unit_price: r.unit_price || null,
          ext_price: r.ext_price || null,
        }).onConflictDoNothing();
      } catch (e: any) {
        quarantined.push({ file: "orders_lines", row: i + 2, error: e.message });
      }
    }
  }

  // ── Quote headers ──
  if (files.quotes_header) {
    const rows = parseCSV(files.quotes_header);
    fileCounts.quotes_header = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const parsed = QuoteHeaderRow.safeParse(rows[i]);
      if (!parsed.success) { quarantined.push({ file: "quotes_header", row: i + 2, error: parsed.error.message }); continue; }
      const r = parsed.data;
      try {
        await db.insert(schema.quote_header).values({
          quote_id: r.quote_id,
          quote_date: toNullableDate(r.quote_date),
          customer_id: r.customer_id,
          branch_id: r.branch_id,
          rep_id: r.rep_id,
          quote_status: r.quote_status || "open",
          order_reference: toNullableStr(r.order_reference),
          total_value: r.total_value || null,
          line_count: r.line_count ? parseInt(r.line_count) : 0,
          multi_option_flag: toBool(r.multi_option_flag),
          ingest_batch_id: batchId,
        }).onConflictDoNothing();
      } catch (e: any) {
        quarantined.push({ file: "quotes_header", row: i + 2, error: e.message });
      }
    }
  }

  // ── Quote lines ──
  if (files.quotes_lines) {
    const rows = parseCSV(files.quotes_lines);
    fileCounts.quotes_lines = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const parsed = QuoteLineRow.safeParse(rows[i]);
      if (!parsed.success) { quarantined.push({ file: "quotes_lines", row: i + 2, error: parsed.error.message }); continue; }
      const r = parsed.data;
      try {
        const lineId = r.quote_line_id || `${r.quote_id}-${r.line_number}`;
        await db.insert(schema.quote_line).values({
          quote_line_id: lineId,
          quote_id: r.quote_id,
          line_number: parseInt(r.line_number),
          sku: toNullableStr(r.sku),
          description: toNullableStr(r.description),
          quantity: r.quantity || null,
          unit_price: r.unit_price || null,
          ext_price: r.ext_price || null,
          option_group: toNullableStr(r.option_group),
          is_alternate: toBool(r.is_alternate),
        }).onConflictDoNothing();
      } catch (e: any) {
        quarantined.push({ file: "quotes_lines", row: i + 2, error: e.message });
      }
    }
  }

  // ── Bookings ──
  if (files.bookings) {
    const rows = parseCSV(files.bookings);
    fileCounts.bookings = rows.length;
    for (let i = 0; i < rows.length; i++) {
      try {
        const r = rows[i];
        if (!r.booking_id || !r.order_id) continue;
        await db.insert(schema.booking).values({
          booking_id: r.booking_id,
          order_id: r.order_id,
          customer_id: r.customer_id || null,
          branch_id: r.branch_id || null,
          rep_id: r.rep_id || null,
          booking_date: toNullableDate(r.booking_date),
          total_value: r.total_value || null,
          status: r.status || "open",
          ingest_batch_id: batchId,
        }).onConflictDoNothing();
      } catch (e: any) {
        quarantined.push({ file: "bookings", row: i + 2, error: e.message });
      }
    }
  }

  // Finalize batch
  await db.update(schema.ingest_batch)
    .set({
      status: "complete",
      file_counts: fileCounts,
      coverage_warnings: warnings,
      quarantined_rows: quarantined,
    })
    .where(require("drizzle-orm").eq(schema.ingest_batch.ingest_batch_id, batchId));

  return { batch_id: batchId, file_counts: fileCounts, coverage_warnings: warnings, quarantined_rows: quarantined };
}
