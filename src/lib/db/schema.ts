import {
  pgTable, text, integer, boolean, numeric, date,
  timestamp, jsonb, index, primaryKey
} from "drizzle-orm/pg-core";

// 1. ingest_batch
export const ingest_batch = pgTable("ingest_batch", {
  ingest_batch_id: text("ingest_batch_id").primaryKey(),
  uploaded_at: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
  uploaded_by: text("uploaded_by"),
  status: text("status").default("pending"),  // pending|complete|failed
  file_counts: jsonb("file_counts"),
  coverage_warnings: jsonb("coverage_warnings"),
  quarantined_rows: jsonb("quarantined_rows"),
  false_loss_rate: numeric("false_loss_rate", { precision: 5, scale: 4 }),
  lists_published: boolean("lists_published").default(false),
}, (t) => ({ uploaded_at_idx: index("ingest_batch_uploaded_at_idx").on(t.uploaded_at) }));

// 2. branch (no FKs to other tables, define first)
export const branch = pgTable("branch", {
  branch_id: text("branch_id").primaryKey(),
  branch_name: text("branch_name").notNull(),
  region: text("region").notNull(),
  manager_rep_id: text("manager_rep_id"),  // FK to rep (self-ref, applied later)
  active: boolean("active").default(true),
});

// 3. rep
export const rep = pgTable("rep", {
  rep_id: text("rep_id").primaryKey(),
  rep_name: text("rep_name").notNull(),
  email: text("email").notNull(),
  branch_id: text("branch_id").references(() => branch.branch_id),
  manager_id: text("manager_id"),  // self-ref FK
  role: text("role").notNull().default("rep"),  // rep|branch-manager|network-admin
  ms_object_id: text("ms_object_id"),
  active: boolean("active").default(true),
}, (t) => ({
  branch_idx: index("rep_branch_idx").on(t.branch_id),
  email_idx: index("rep_email_idx").on(t.email),
  role_idx: index("rep_role_idx").on(t.role),
}));

// 4. customer_master
export const customer_master = pgTable("customer_master", {
  customer_id: text("customer_id").primaryKey(),
  customer_name: text("customer_name").notNull(),
  branch_id: text("branch_id").references(() => branch.branch_id),
  rep_id: text("rep_id").references(() => rep.rep_id),
  tier: text("tier").default("C"),  // A|B|C
  is_repeat: boolean("is_repeat").default(false),
  buys_off_quotes: numeric("buys_off_quotes", { precision: 4, scale: 3 }).default("0"),
  ltm_sales: numeric("ltm_sales", { precision: 14, scale: 2 }).default("0"),
  contact_email: text("contact_email"),
  contact_mobile: text("contact_mobile"),
  opt_out_flag: boolean("opt_out_flag").default(false),
  opt_out_channel: text("opt_out_channel"),  // email|sms|all
  account_type: text("account_type").default("unknown"),  // house|key|national|unknown
}, (t) => ({
  branch_idx: index("cm_branch_idx").on(t.branch_id),
  rep_idx: index("cm_rep_idx").on(t.rep_id),
  tier_idx: index("cm_tier_idx").on(t.tier),
}));

// 5. credit_status
export const credit_status = pgTable("credit_status", {
  customer_id: text("customer_id").primaryKey().references(() => customer_master.customer_id),
  credit_hold: boolean("credit_hold").default(false),
  credit_standing: text("credit_standing").default("good"),  // good|review|hold|suspended
  credit_limit: numeric("credit_limit", { precision: 14, scale: 2 }),
  current_balance: numeric("current_balance", { precision: 14, scale: 2 }),
  days_past_due: integer("days_past_due").default(0),
  as_of_date: date("as_of_date"),
  ingest_batch_id: text("ingest_batch_id").references(() => ingest_batch.ingest_batch_id),
}, (t) => ({
  hold_idx: index("cs_credit_hold_idx").on(t.credit_hold),
  standing_idx: index("cs_credit_standing_idx").on(t.credit_standing),
}));

// 6. order_header (needed before quote_header for the FK)
export const order_header = pgTable("order_header", {
  order_id: text("order_id").primaryKey(),
  order_date: date("order_date"),
  customer_id: text("customer_id").references(() => customer_master.customer_id),
  branch_id: text("branch_id").references(() => branch.branch_id),
  rep_id: text("rep_id").references(() => rep.rep_id),
  order_type: text("order_type").default("unknown"),  // walk-in|quoted|unknown
  invoice_status: text("invoice_status").default("open"),  // open|invoiced|cancelled
  originating_quote_id: text("originating_quote_id"),  // FK to quote_header (circular, added later)
  total_value: numeric("total_value", { precision: 14, scale: 2 }),
  ingest_batch_id: text("ingest_batch_id").references(() => ingest_batch.ingest_batch_id),
}, (t) => ({
  customer_idx: index("oh_customer_idx").on(t.customer_id),
  orig_quote_idx: index("oh_originating_quote_idx").on(t.originating_quote_id),
  order_date_idx: index("oh_order_date_idx").on(t.order_date),
  invoice_status_idx: index("oh_invoice_status_idx").on(t.invoice_status),
}));

// 7. quote_header
export const quote_header = pgTable("quote_header", {
  quote_id: text("quote_id").primaryKey(),
  quote_date: date("quote_date"),
  expiration_date: date("expiration_date"),
  customer_id: text("customer_id").references(() => customer_master.customer_id),
  branch_id: text("branch_id").references(() => branch.branch_id),
  rep_id: text("rep_id").references(() => rep.rep_id),
  quote_status: text("quote_status").default("open"),  // open|expired|closed|unknown
  order_reference: text("order_reference").references(() => order_header.order_id),
  total_value: numeric("total_value", { precision: 14, scale: 2 }),
  line_count: integer("line_count").default(0),
  multi_option_flag: boolean("multi_option_flag").default(false),
  ingest_batch_id: text("ingest_batch_id").references(() => ingest_batch.ingest_batch_id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  rep_idx: index("qh_rep_idx").on(t.rep_id),
  branch_idx: index("qh_branch_idx").on(t.branch_id),
  customer_idx: index("qh_customer_idx").on(t.customer_id),
  batch_idx: index("qh_batch_idx").on(t.ingest_batch_id),
  status_idx: index("qh_status_idx").on(t.quote_status),
}));

// 8. quote_line
export const quote_line = pgTable("quote_line", {
  quote_line_id: text("quote_line_id").primaryKey(),  // quote_id + line_number
  quote_id: text("quote_id").references(() => quote_header.quote_id),
  line_number: integer("line_number").notNull(),
  sku: text("sku"),
  description: text("description"),
  quantity: numeric("quantity", { precision: 14, scale: 3 }),
  unit_price: numeric("unit_price", { precision: 14, scale: 4 }),
  ext_price: numeric("ext_price", { precision: 14, scale: 2 }),
  option_group: text("option_group"),
  is_alternate: boolean("is_alternate").default(false),
  // Pipeline-written fields
  match_status: text("match_status"),  // won-direct|won-likely|open|lost|dead-alternate|suppressed
  match_order_id: text("match_order_id").references(() => order_header.order_id),
  match_confidence: numeric("match_confidence", { precision: 4, scale: 3 }),
  intent_class: text("intent_class"),  // real-quote|price-check|unknown
  score: integer("score"),  // 0-100
  bucket: text("bucket"),  // rep-worked|automated-long-tail|suppressed
  suppression_reason: text("suppression_reason"),  // won|dead-alternate|price-check|credit-hold|opt-out|manual
}, (t) => ({
  quote_idx: index("ql_quote_idx").on(t.quote_id),
  option_group_idx: index("ql_option_group_idx").on(t.option_group),
  bucket_idx: index("ql_bucket_idx").on(t.bucket),
  match_status_idx: index("ql_match_status_idx").on(t.match_status),
  score_idx: index("ql_score_idx").on(t.score),
  bucket_score_idx: index("ql_bucket_score_idx").on(t.bucket, t.score),
}));

// 9. order_line
export const order_line = pgTable("order_line", {
  order_line_id: text("order_line_id").primaryKey(),  // order_id + line_number
  order_id: text("order_id").references(() => order_header.order_id),
  line_number: integer("line_number").notNull(),
  sku: text("sku"),
  description: text("description"),
  quantity: numeric("quantity", { precision: 14, scale: 3 }),
  unit_price: numeric("unit_price", { precision: 14, scale: 4 }),
  ext_price: numeric("ext_price", { precision: 14, scale: 2 }),
  originating_quote_line_id: text("originating_quote_line_id").references(() => quote_line.quote_line_id),
}, (t) => ({
  order_idx: index("ol_order_idx").on(t.order_id),
  sku_idx: index("ol_sku_idx").on(t.sku),
  order_sku_idx: index("ol_order_sku_idx").on(t.order_id, t.sku),
}));

// 10. booking
export const booking = pgTable("booking", {
  booking_id: text("booking_id").primaryKey(),
  order_id: text("order_id").references(() => order_header.order_id),
  customer_id: text("customer_id").references(() => customer_master.customer_id),
  branch_id: text("branch_id").references(() => branch.branch_id),
  rep_id: text("rep_id").references(() => rep.rep_id),
  booking_date: date("booking_date"),
  total_value: numeric("total_value", { precision: 14, scale: 2 }),
  status: text("status").default("open"),  // open|partially-shipped|cancelled
  ingest_batch_id: text("ingest_batch_id").references(() => ingest_batch.ingest_batch_id),
}, (t) => ({
  order_idx: index("bk_order_idx").on(t.order_id),
  customer_idx: index("bk_customer_idx").on(t.customer_id),
}));

// 11. follow_up_record
export const follow_up_record = pgTable("follow_up_record", {
  followup_id: text("followup_id").primaryKey(),  // uuid
  quote_id: text("quote_id").references(() => quote_header.quote_id),
  rep_id: text("rep_id").references(() => rep.rep_id),
  generated_at: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  draft_subject: text("draft_subject"),
  draft_body: text("draft_body"),
  draft_version: integer("draft_version").default(1),
  send_intent_at: timestamp("send_intent_at", { withTimezone: true }),
  send_channel: text("send_channel").default("none"),  // email|sms|none
  outcome: text("outcome").default("pending"),  // pending|sent|won|lost|not-interested|already-handled|suppressed
  outcome_recorded_at: timestamp("outcome_recorded_at", { withTimezone: true }),
  outcome_recorded_by: text("outcome_recorded_by").references(() => rep.rep_id),
  automated_flag: boolean("automated_flag").default(false),
}, (t) => ({
  quote_idx: index("fur_quote_idx").on(t.quote_id),
  rep_idx: index("fur_rep_idx").on(t.rep_id),
  outcome_idx: index("fur_outcome_idx").on(t.outcome),
}));

// 12. config_rule
export const config_rule = pgTable("config_rule", {
  rule_id: text("rule_id").primaryKey(),  // uuid
  tier: text("tier").notNull(),  // network|branch|individual
  owner_id: text("owner_id"),  // null=network / branch_id / rep_id
  rule_text: text("rule_text").notNull(),
  rule_type: text("rule_type").notNull(),  // min-value-threshold|customer-exclusion|channel-preference|cadence-override|suppression|scoring-weight
  parsed_logic: jsonb("parsed_logic"),
  active: boolean("active").default(true),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  created_by: text("created_by").references(() => rep.rep_id),
  effective_from: date("effective_from"),
  effective_to: date("effective_to"),
  override_tier: text("override_tier"),
}, (t) => ({
  tier_idx: index("cr_tier_idx").on(t.tier),
  owner_idx: index("cr_owner_idx").on(t.owner_id),
  rule_type_idx: index("cr_rule_type_idx").on(t.rule_type),
  active_idx: index("cr_active_idx").on(t.active),
}));
