import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL!;

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool, { schema });

  // Run migrations first
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("Migrations done.");

  // Truncate in reverse FK order
  await pool.query(`
    TRUNCATE config_rule, follow_up_record, booking, order_line, quote_line,
             order_header, quote_header, credit_status, customer_master,
             rep, branch, ingest_batch CASCADE
  `);

  console.log("Tables truncated.");

  // ── INGEST BATCH ──────────────────────────────────────────────
  await db.insert(schema.ingest_batch).values({
    ingest_batch_id: "seed-batch-001",
    uploaded_by: "admin",
    status: "complete",
    file_counts: { quotes: 20, orders: 15, bookings: 5, customers: 10, credit: 10 },
    coverage_warnings: [],
    quarantined_rows: [],
    false_loss_rate: "0.00",
    lists_published: true,
  });

  // ── BRANCH ────────────────────────────────────────────────────
  await db.insert(schema.branch).values({
    branch_id: "branch-001",
    branch_name: "Midwest Distribution",
    region: "Midwest",
    active: true,
  });

  // ── REPS ──────────────────────────────────────────────────────
  await db.insert(schema.rep).values([
    {
      rep_id: "rep-admin-001",
      rep_name: "Admin User",
      email: "admin@singerindustrial.com",
      branch_id: "branch-001",
      role: "network-admin",
      ms_object_id: "ms-admin-001",
      active: true,
    },
    {
      rep_id: "rep-manager-001",
      rep_name: "Branch Manager",
      email: "manager@singerindustrial.com",
      branch_id: "branch-001",
      role: "branch-manager",
      ms_object_id: "ms-manager-001",
      active: true,
    },
    {
      rep_id: "rep-test-001",
      rep_name: "Test Rep",
      email: "rep.test@singerindustrial.com",
      branch_id: "branch-001",
      manager_id: "rep-manager-001",
      role: "rep",
      ms_object_id: "ms-rep-001",
      active: true,
    },
    {
      rep_id: "rep-demo-001",
      rep_name: "Demo Rep",
      email: "demo@singerindustrial.com",
      branch_id: "branch-001",
      manager_id: "rep-manager-001",
      role: "rep",
      ms_object_id: "ms-demo-001",
      active: true,
    },
    {
      rep_id: "rep-002",
      rep_name: "Sarah Johnson",
      email: "sarah.johnson@singerindustrial.com",
      branch_id: "branch-001",
      manager_id: "rep-manager-001",
      role: "rep",
      ms_object_id: "ms-rep-002",
      active: true,
    },
  ]);

  // Update branch with manager
  await db.update(schema.branch)
    .set({ manager_rep_id: "rep-manager-001" })
    .where(eq(schema.branch.branch_id, "branch-001"));

  // ── CUSTOMERS ─────────────────────────────────────────────────
  await db.insert(schema.customer_master).values([
    // AC-05: tier-A, buys_off_quotes=0.80, repeat
    {
      customer_id: "cust-ac05",
      customer_name: "Acme Manufacturing",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      tier: "A",
      is_repeat: true,
      buys_off_quotes: "0.800",
      ltm_sales: "450000.00",
      contact_email: "buyer@acme.com",
      opt_out_flag: false,
      account_type: "key",
    },
    // AC-03: credit hold customer
    {
      customer_id: "cust-credit-hold",
      customer_name: "Risky Corp",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      tier: "B",
      is_repeat: true,
      buys_off_quotes: "0.400",
      ltm_sales: "80000.00",
      contact_email: "buyer@risky.com",
      opt_out_flag: false,
      account_type: "house",
    },
    // AC-08: opt-out all customer
    {
      customer_id: "cust-optout",
      customer_name: "No Contact LLC",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      tier: "A",
      is_repeat: true,
      buys_off_quotes: "0.700",
      ltm_sales: "200000.00",
      contact_email: "buyer@nocontact.com",
      opt_out_flag: true,
      opt_out_channel: "all",
      account_type: "key",
    },
    // AC-07: price-check customer
    {
      customer_id: "cust-pricechecker",
      customer_name: "Price Check Inc",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      tier: "C",
      is_repeat: false,
      buys_off_quotes: "0.050",
      ltm_sales: "15000.00",
      contact_email: "buyer@pricecheck.com",
      opt_out_flag: false,
      account_type: "unknown",
    },
    // AC-06 customer
    {
      customer_id: "cust-ac06",
      customer_name: "Midwest Widgets",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      tier: "B",
      is_repeat: true,
      buys_off_quotes: "0.500",
      ltm_sales: "120000.00",
      contact_email: "buyer@midwestwidgets.com",
      opt_out_flag: false,
      account_type: "house",
    },
    // General tier-A customer for rep-test
    {
      customer_id: "cust-tier-a-general",
      customer_name: "General Tier A",
      branch_id: "branch-001",
      rep_id: "rep-test-001",
      tier: "A",
      is_repeat: true,
      buys_off_quotes: "0.650",
      ltm_sales: "300000.00",
      contact_email: "buyer@tierageneral.com",
      opt_out_flag: false,
      account_type: "key",
    },
    // Tier-C general
    {
      customer_id: "cust-tier-c",
      customer_name: "Small Buyer Corp",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      tier: "C",
      is_repeat: false,
      buys_off_quotes: "0.200",
      ltm_sales: "8000.00",
      opt_out_flag: false,
      account_type: "unknown",
    },
  ]);

  // ── CREDIT STATUS ─────────────────────────────────────────────
  await db.insert(schema.credit_status).values([
    { customer_id: "cust-ac05", credit_hold: false, credit_standing: "good", credit_limit: "500000.00", current_balance: "45000.00", days_past_due: 0, as_of_date: "2026-06-01", ingest_batch_id: "seed-batch-001" },
    { customer_id: "cust-credit-hold", credit_hold: true, credit_standing: "hold", credit_limit: "50000.00", current_balance: "62000.00", days_past_due: 65, as_of_date: "2026-06-01", ingest_batch_id: "seed-batch-001" },
    { customer_id: "cust-optout", credit_hold: false, credit_standing: "good", credit_limit: "300000.00", current_balance: "12000.00", days_past_due: 0, as_of_date: "2026-06-01", ingest_batch_id: "seed-batch-001" },
    { customer_id: "cust-pricechecker", credit_hold: false, credit_standing: "good", credit_limit: "20000.00", current_balance: "0.00", days_past_due: 0, as_of_date: "2026-06-01", ingest_batch_id: "seed-batch-001" },
    { customer_id: "cust-ac06", credit_hold: false, credit_standing: "good", credit_limit: "200000.00", current_balance: "18000.00", days_past_due: 5, as_of_date: "2026-06-01", ingest_batch_id: "seed-batch-001" },
    { customer_id: "cust-tier-a-general", credit_hold: false, credit_standing: "good", credit_limit: "400000.00", current_balance: "30000.00", days_past_due: 0, as_of_date: "2026-06-01", ingest_batch_id: "seed-batch-001" },
    { customer_id: "cust-tier-c", credit_hold: false, credit_standing: "good", credit_limit: "15000.00", current_balance: "2000.00", days_past_due: 0, as_of_date: "2026-06-01", ingest_batch_id: "seed-batch-001" },
  ]);

  // ── ORDERS (needed before quotes for FK) ─────────────────────
  // AC-04: matched order for option group quote
  await db.insert(schema.order_header).values([
    {
      order_id: "ord-ac04-001",
      order_date: "2026-06-15",
      customer_id: "cust-ac05",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      order_type: "quoted",
      invoice_status: "invoiced",
      total_value: "8500.00",
      ingest_batch_id: "seed-batch-001",
    },
    // Prior purchase order for AC-05 (same SKU, establishes history)
    {
      order_id: "ord-prior-ac05",
      order_date: "2026-01-10",
      customer_id: "cust-ac05",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      order_type: "quoted",
      invoice_status: "invoiced",
      total_value: "11500.00",
      ingest_batch_id: "seed-batch-001",
    },
    // Walk-in order (no quote link)
    {
      order_id: "ord-walkin-001",
      order_date: "2026-06-20",
      customer_id: "cust-tier-c",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      order_type: "walk-in",
      invoice_status: "invoiced",
      total_value: "1200.00",
      ingest_batch_id: "seed-batch-001",
    },
  ]);

  // Order lines for prior purchase (AC-05 SKU history)
  await db.insert(schema.order_line).values([
    { order_line_id: "ol-prior-ac05-1", order_id: "ord-prior-ac05", line_number: 1, sku: "SKU-BEARING-X200", description: "Industrial Bearing X200", quantity: "50.000", unit_price: "230.0000", ext_price: "11500.00" },
  ]);

  // ── QUOTES ────────────────────────────────────────────────────
  const tenDaysAgo = new Date(); tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
  const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split("T")[0];

  await db.insert(schema.quote_header).values([
    // AC-05: The exact quote that must score 95
    {
      quote_id: "quote-ac05",
      quote_date: tenDaysAgoStr,
      customer_id: "cust-ac05",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      total_value: "12000.00",
      line_count: 1,
      multi_option_flag: false,
      ingest_batch_id: "seed-batch-001",
    },
    // AC-04: Multi-option quote (2 lines, option_group)
    {
      quote_id: "quote-ac04",
      quote_date: thirtyDaysAgoStr,
      customer_id: "cust-ac05",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      order_reference: "ord-ac04-001",
      total_value: "17000.00",
      line_count: 2,
      multi_option_flag: true,
      ingest_batch_id: "seed-batch-001",
    },
    // AC-03: Credit hold quote (should be suppressed)
    {
      quote_id: "quote-ac03",
      quote_date: thirtyDaysAgoStr,
      customer_id: "cust-credit-hold",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      total_value: "8000.00",
      line_count: 1,
      multi_option_flag: false,
      ingest_batch_id: "seed-batch-001",
    },
    // AC-08: Opt-out quote (should be suppressed)
    {
      quote_id: "quote-ac08",
      quote_date: tenDaysAgoStr,
      customer_id: "cust-optout",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      total_value: "25000.00",
      line_count: 1,
      multi_option_flag: false,
      ingest_batch_id: "seed-batch-001",
    },
    // AC-07: Price-check quote (first occurrence)
    {
      quote_id: "quote-ac07",
      quote_date: thirtyDaysAgoStr,
      customer_id: "cust-pricechecker",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      total_value: "3500.00",
      line_count: 1,
      multi_option_flag: false,
      ingest_batch_id: "seed-batch-001",
    },
    // AC-07 second price-check (same customer, same SKU, within 60 days)
    {
      quote_id: "quote-ac07b",
      quote_date: sixtyDaysAgoStr,
      customer_id: "cust-pricechecker",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      total_value: "3500.00",
      line_count: 1,
      multi_option_flag: false,
      ingest_batch_id: "seed-batch-001",
    },
    // AC-06: Three threshold test quotes ($499, $750, $6000)
    {
      quote_id: "quote-ac06-499",
      quote_date: tenDaysAgoStr,
      customer_id: "cust-ac06",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      total_value: "499.00",
      line_count: 1,
      ingest_batch_id: "seed-batch-001",
    },
    {
      quote_id: "quote-ac06-750",
      quote_date: tenDaysAgoStr,
      customer_id: "cust-ac06",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      total_value: "750.00",
      line_count: 1,
      ingest_batch_id: "seed-batch-001",
    },
    {
      quote_id: "quote-ac06-6000",
      quote_date: tenDaysAgoStr,
      customer_id: "cust-ac06",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      total_value: "6000.00",
      line_count: 1,
      ingest_batch_id: "seed-batch-001",
    },
    // AC-01: Rep-worked quote for rep-test-001 (score ≥60)
    {
      quote_id: "quote-ac01-reptest",
      quote_date: tenDaysAgoStr,
      customer_id: "cust-tier-a-general",
      branch_id: "branch-001",
      rep_id: "rep-test-001",
      quote_status: "open",
      total_value: "18000.00",
      line_count: 1,
      ingest_batch_id: "seed-batch-001",
    },
    // AC-10: Quote without originating_quote_id (for coverage warning testing)
    {
      quote_id: "quote-ac10",
      quote_date: thirtyDaysAgoStr,
      customer_id: "cust-tier-c",
      branch_id: "branch-001",
      rep_id: "rep-demo-001",
      quote_status: "open",
      total_value: "950.00",
      line_count: 1,
      ingest_batch_id: "seed-batch-001",
    },
  ]);

  // ── QUOTE LINES ───────────────────────────────────────────────
  await db.insert(schema.quote_line).values([
    // AC-05 line (same SKU as prior purchase order)
    {
      quote_line_id: "ql-ac05-1",
      quote_id: "quote-ac05",
      line_number: 1,
      sku: "SKU-BEARING-X200",
      description: "Industrial Bearing X200",
      quantity: "50.000",
      unit_price: "240.0000",
      ext_price: "12000.00",
      is_alternate: false,
    },
    // AC-04: Two option_group lines
    {
      quote_line_id: "ql-ac04-1",
      quote_id: "quote-ac04",
      line_number: 1,
      sku: "SKU-PUMP-A",
      description: "Centrifugal Pump Model A",
      quantity: "2.000",
      unit_price: "4250.0000",
      ext_price: "8500.00",
      option_group: "pump-option",
      is_alternate: false,
    },
    {
      quote_line_id: "ql-ac04-2",
      quote_id: "quote-ac04",
      line_number: 2,
      sku: "SKU-PUMP-B",
      description: "Centrifugal Pump Model B",
      quantity: "2.000",
      unit_price: "4250.0000",
      ext_price: "8500.00",
      option_group: "pump-option",
      is_alternate: true,
    },
    // AC-03 credit hold
    {
      quote_line_id: "ql-ac03-1",
      quote_id: "quote-ac03",
      line_number: 1,
      sku: "SKU-VALVE-100",
      description: "Ball Valve 100mm",
      quantity: "10.000",
      unit_price: "800.0000",
      ext_price: "8000.00",
    },
    // AC-08 opt-out
    {
      quote_line_id: "ql-ac08-1",
      quote_id: "quote-ac08",
      line_number: 1,
      sku: "SKU-MOTOR-5HP",
      description: "Electric Motor 5HP",
      quantity: "5.000",
      unit_price: "5000.0000",
      ext_price: "25000.00",
    },
    // AC-07 price check (first occurrence)
    {
      quote_line_id: "ql-ac07-1",
      quote_id: "quote-ac07",
      line_number: 1,
      sku: "SKU-FITTING-STD",
      description: "Standard Pipe Fitting",
      quantity: "100.000",
      unit_price: "35.0000",
      ext_price: "3500.00",
    },
    // AC-07 price check (second occurrence - same SKU signals price-check pattern)
    {
      quote_line_id: "ql-ac07b-1",
      quote_id: "quote-ac07b",
      line_number: 1,
      sku: "SKU-FITTING-STD",
      description: "Standard Pipe Fitting",
      quantity: "100.000",
      unit_price: "35.0000",
      ext_price: "3500.00",
    },
    // AC-06 threshold quotes
    {
      quote_line_id: "ql-ac06-499-1",
      quote_id: "quote-ac06-499",
      line_number: 1,
      sku: "SKU-SEAL-SMALL",
      description: "O-Ring Seal Pack",
      quantity: "50.000",
      unit_price: "9.9800",
      ext_price: "499.00",
    },
    {
      quote_line_id: "ql-ac06-750-1",
      quote_id: "quote-ac06-750",
      line_number: 1,
      sku: "SKU-GASKET-MED",
      description: "Medium Gasket",
      quantity: "30.000",
      unit_price: "25.0000",
      ext_price: "750.00",
    },
    {
      quote_line_id: "ql-ac06-6000-1",
      quote_id: "quote-ac06-6000",
      line_number: 1,
      sku: "SKU-PUMP-SMALL",
      description: "Small Process Pump",
      quantity: "2.000",
      unit_price: "3000.0000",
      ext_price: "6000.00",
    },
    // AC-01 rep-test
    {
      quote_line_id: "ql-ac01-1",
      quote_id: "quote-ac01-reptest",
      line_number: 1,
      sku: "SKU-GEARBOX-XL",
      description: "Industrial Gearbox XL",
      quantity: "3.000",
      unit_price: "6000.0000",
      ext_price: "18000.00",
    },
    // AC-10: quote fixture without originating_quote_id (coverage warning)
    {
      quote_line_id: "ql-ac10-1",
      quote_id: "quote-ac10",
      line_number: 1,
      sku: "SKU-CLAMP-SM",
      description: "Small Pipe Clamp",
      quantity: "25.000",
      unit_price: "38.0000",
      ext_price: "950.00",
    },
  ]);

  // Order lines for AC-04 matched order
  await db.insert(schema.order_line).values([
    {
      order_line_id: "ol-ac04-1",
      order_id: "ord-ac04-001",
      line_number: 1,
      sku: "SKU-PUMP-A",
      description: "Centrifugal Pump Model A",
      quantity: "2.000",
      unit_price: "4250.0000",
      ext_price: "8500.00",
    },
  ]);

  // ── CONFIG RULES (AC-06) ──────────────────────────────────────
  await db.insert(schema.config_rule).values([
    {
      rule_id: uuidv4(),
      tier: "network",
      owner_id: null,
      rule_text: "Follow up on all quotes over $1,000",
      rule_type: "min-value-threshold",
      parsed_logic: { min_value: 1000 },
      active: true,
      created_by: "rep-admin-001",
      effective_from: "2026-01-01",
    },
    {
      rule_id: uuidv4(),
      tier: "branch",
      owner_id: "branch-001",
      rule_text: "For this branch, only follow up on quotes over $5,000",
      rule_type: "min-value-threshold",
      parsed_logic: { min_value: 5000 },
      active: true,
      created_by: "rep-manager-001",
      effective_from: "2026-01-01",
    },
    {
      rule_id: uuidv4(),
      tier: "individual",
      owner_id: "rep-demo-001",
      rule_text: "I want to follow up on any quote over $500",
      rule_type: "min-value-threshold",
      parsed_logic: { min_value: 500 },
      active: true,
      created_by: "rep-demo-001",
      effective_from: "2026-01-01",
    },
  ]);

  console.log("Seed data inserted. Simulating pipeline results...");

  // ── PIPELINE SIMULATION ───────────────────────────────────────
  // Pre-compute scores/buckets so the happy-flow user can see the worklist
  // without needing to run the pipeline separately.

  // AC-05: tier-A + buys_off_quotes=0.80 + prior SKU + $12K + 10-day-old + good credit + open + real-quote → score=95
  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "real-quote",
      score: 95,
      bucket: "rep-worked",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac05-1"));

  // AC-04: option_group — line 1 won-direct, line 2 dead-alternate
  await db.update(schema.quote_line)
    .set({
      match_status: "won-direct",
      match_order_id: "ord-ac04-001",
      match_confidence: "1.000",
      score: 0,
      bucket: "suppressed",
      suppression_reason: "won",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac04-1"));

  await db.update(schema.quote_line)
    .set({
      match_status: "dead-alternate",
      score: 0,
      bucket: "suppressed",
      suppression_reason: "dead-alternate",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac04-2"));

  // AC-03: credit_hold suppression
  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "real-quote",
      score: 55,
      bucket: "suppressed",
      suppression_reason: "credit-hold",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac03-1"));

  // AC-08: opt-out suppression (high score, still suppressed)
  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "real-quote",
      score: 88,
      bucket: "suppressed",
      suppression_reason: "opt-out",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac08-1"));

  // AC-07: price-check classification (≥2 signals for same SKU)
  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "price-check",
      score: 20,
      bucket: "suppressed",
      suppression_reason: "price-check",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac07-1"));

  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "price-check",
      score: 20,
      bucket: "suppressed",
      suppression_reason: "price-check",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac07b-1"));

  // AC-06: Three threshold quotes
  // $499 — below individual threshold ($500), suppressed
  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "real-quote",
      score: 15,
      bucket: "suppressed",
      suppression_reason: "manual",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac06-499-1"));

  // $750 — above individual ($500) threshold, automated long-tail
  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "real-quote",
      score: 40,
      bucket: "automated-long-tail",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac06-750-1"));

  // $6000 — above branch ($5000) threshold, rep-worked
  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "real-quote",
      score: 72,
      bucket: "rep-worked",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac06-6000-1"));

  // AC-01: rep-test quote scored ≥60, rep-worked
  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "real-quote",
      score: 82,
      bucket: "rep-worked",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac01-1"));

  // AC-10: open quote without originating_quote_id on order (coverage warning scenario)
  await db.update(schema.quote_line)
    .set({
      match_status: "open",
      intent_class: "real-quote",
      score: 35,
      bucket: "automated-long-tail",
    })
    .where(eq(schema.quote_line.quote_line_id, "ql-ac10-1"));

  console.log("Pipeline simulation complete.");
  console.log("");
  console.log("Seed complete. Demo users:");
  console.log("  demo@singerindustrial.com        (rep, sees ranked worklist)");
  console.log("  rep.test@singerindustrial.com    (rep, has ≥1 quote score≥60)");
  console.log("  manager@singerindustrial.com     (branch-manager)");
  console.log("  admin@singerindustrial.com       (network-admin)");
  console.log("  Password for all: Demo1234!");

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
