CREATE TABLE IF NOT EXISTS "booking" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"customer_id" text,
	"branch_id" text,
	"rep_id" text,
	"booking_date" date,
	"total_value" numeric(14, 2),
	"status" text DEFAULT 'open',
	"ingest_batch_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "branch" (
	"branch_id" text PRIMARY KEY NOT NULL,
	"branch_name" text NOT NULL,
	"region" text NOT NULL,
	"manager_rep_id" text,
	"active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "config_rule" (
	"rule_id" text PRIMARY KEY NOT NULL,
	"tier" text NOT NULL,
	"owner_id" text,
	"rule_text" text NOT NULL,
	"rule_type" text NOT NULL,
	"parsed_logic" jsonb,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"effective_from" date,
	"effective_to" date,
	"override_tier" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_status" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"credit_hold" boolean DEFAULT false,
	"credit_standing" text DEFAULT 'good',
	"credit_limit" numeric(14, 2),
	"current_balance" numeric(14, 2),
	"days_past_due" integer DEFAULT 0,
	"as_of_date" date,
	"ingest_batch_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_master" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"branch_id" text,
	"rep_id" text,
	"tier" text DEFAULT 'C',
	"is_repeat" boolean DEFAULT false,
	"buys_off_quotes" numeric(4, 3) DEFAULT '0',
	"ltm_sales" numeric(14, 2) DEFAULT '0',
	"contact_email" text,
	"contact_mobile" text,
	"opt_out_flag" boolean DEFAULT false,
	"opt_out_channel" text,
	"account_type" text DEFAULT 'unknown'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "follow_up_record" (
	"followup_id" text PRIMARY KEY NOT NULL,
	"quote_id" text,
	"rep_id" text,
	"generated_at" timestamp with time zone DEFAULT now(),
	"draft_subject" text,
	"draft_body" text,
	"draft_version" integer DEFAULT 1,
	"send_intent_at" timestamp with time zone,
	"send_channel" text DEFAULT 'none',
	"outcome" text DEFAULT 'pending',
	"outcome_recorded_at" timestamp with time zone,
	"outcome_recorded_by" text,
	"automated_flag" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingest_batch" (
	"ingest_batch_id" text PRIMARY KEY NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now(),
	"uploaded_by" text,
	"status" text DEFAULT 'pending',
	"file_counts" jsonb,
	"coverage_warnings" jsonb,
	"quarantined_rows" jsonb,
	"false_loss_rate" numeric(5, 4),
	"lists_published" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_header" (
	"order_id" text PRIMARY KEY NOT NULL,
	"order_date" date,
	"customer_id" text,
	"branch_id" text,
	"rep_id" text,
	"order_type" text DEFAULT 'unknown',
	"invoice_status" text DEFAULT 'open',
	"originating_quote_id" text,
	"total_value" numeric(14, 2),
	"ingest_batch_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_line" (
	"order_line_id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"line_number" integer NOT NULL,
	"sku" text,
	"description" text,
	"quantity" numeric(14, 3),
	"unit_price" numeric(14, 4),
	"ext_price" numeric(14, 2),
	"originating_quote_line_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_header" (
	"quote_id" text PRIMARY KEY NOT NULL,
	"quote_date" date,
	"expiration_date" date,
	"customer_id" text,
	"branch_id" text,
	"rep_id" text,
	"quote_status" text DEFAULT 'open',
	"order_reference" text,
	"total_value" numeric(14, 2),
	"line_count" integer DEFAULT 0,
	"multi_option_flag" boolean DEFAULT false,
	"ingest_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_line" (
	"quote_line_id" text PRIMARY KEY NOT NULL,
	"quote_id" text,
	"line_number" integer NOT NULL,
	"sku" text,
	"description" text,
	"quantity" numeric(14, 3),
	"unit_price" numeric(14, 4),
	"ext_price" numeric(14, 2),
	"option_group" text,
	"is_alternate" boolean DEFAULT false,
	"match_status" text,
	"match_order_id" text,
	"match_confidence" numeric(4, 3),
	"intent_class" text,
	"score" integer,
	"bucket" text,
	"suppression_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rep" (
	"rep_id" text PRIMARY KEY NOT NULL,
	"rep_name" text NOT NULL,
	"email" text NOT NULL,
	"branch_id" text,
	"manager_id" text,
	"role" text DEFAULT 'rep' NOT NULL,
	"ms_object_id" text,
	"active" boolean DEFAULT true
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking" ADD CONSTRAINT "booking_order_id_order_header_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order_header"("order_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking" ADD CONSTRAINT "booking_customer_id_customer_master_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_master"("customer_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking" ADD CONSTRAINT "booking_branch_id_branch_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("branch_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking" ADD CONSTRAINT "booking_rep_id_rep_rep_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."rep"("rep_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking" ADD CONSTRAINT "booking_ingest_batch_id_ingest_batch_ingest_batch_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."ingest_batch"("ingest_batch_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "config_rule" ADD CONSTRAINT "config_rule_created_by_rep_rep_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."rep"("rep_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_status" ADD CONSTRAINT "credit_status_customer_id_customer_master_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_master"("customer_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_status" ADD CONSTRAINT "credit_status_ingest_batch_id_ingest_batch_ingest_batch_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."ingest_batch"("ingest_batch_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_master" ADD CONSTRAINT "customer_master_branch_id_branch_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("branch_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_master" ADD CONSTRAINT "customer_master_rep_id_rep_rep_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."rep"("rep_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follow_up_record" ADD CONSTRAINT "follow_up_record_quote_id_quote_header_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_header"("quote_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follow_up_record" ADD CONSTRAINT "follow_up_record_rep_id_rep_rep_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."rep"("rep_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follow_up_record" ADD CONSTRAINT "follow_up_record_outcome_recorded_by_rep_rep_id_fk" FOREIGN KEY ("outcome_recorded_by") REFERENCES "public"."rep"("rep_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_header" ADD CONSTRAINT "order_header_customer_id_customer_master_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_master"("customer_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_header" ADD CONSTRAINT "order_header_branch_id_branch_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("branch_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_header" ADD CONSTRAINT "order_header_rep_id_rep_rep_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."rep"("rep_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_header" ADD CONSTRAINT "order_header_ingest_batch_id_ingest_batch_ingest_batch_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."ingest_batch"("ingest_batch_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_order_header_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order_header"("order_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_line" ADD CONSTRAINT "order_line_originating_quote_line_id_quote_line_quote_line_id_fk" FOREIGN KEY ("originating_quote_line_id") REFERENCES "public"."quote_line"("quote_line_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_header" ADD CONSTRAINT "quote_header_customer_id_customer_master_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_master"("customer_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_header" ADD CONSTRAINT "quote_header_branch_id_branch_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("branch_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_header" ADD CONSTRAINT "quote_header_rep_id_rep_rep_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."rep"("rep_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_header" ADD CONSTRAINT "quote_header_order_reference_order_header_order_id_fk" FOREIGN KEY ("order_reference") REFERENCES "public"."order_header"("order_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_header" ADD CONSTRAINT "quote_header_ingest_batch_id_ingest_batch_ingest_batch_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."ingest_batch"("ingest_batch_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_line" ADD CONSTRAINT "quote_line_quote_id_quote_header_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_header"("quote_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_line" ADD CONSTRAINT "quote_line_match_order_id_order_header_order_id_fk" FOREIGN KEY ("match_order_id") REFERENCES "public"."order_header"("order_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rep" ADD CONSTRAINT "rep_branch_id_branch_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("branch_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bk_order_idx" ON "booking" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bk_customer_idx" ON "booking" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cr_tier_idx" ON "config_rule" USING btree ("tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cr_owner_idx" ON "config_rule" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cr_rule_type_idx" ON "config_rule" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cr_active_idx" ON "config_rule" USING btree ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cs_credit_hold_idx" ON "credit_status" USING btree ("credit_hold");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cs_credit_standing_idx" ON "credit_status" USING btree ("credit_standing");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cm_branch_idx" ON "customer_master" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cm_rep_idx" ON "customer_master" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cm_tier_idx" ON "customer_master" USING btree ("tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fur_quote_idx" ON "follow_up_record" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fur_rep_idx" ON "follow_up_record" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fur_outcome_idx" ON "follow_up_record" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingest_batch_uploaded_at_idx" ON "ingest_batch" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oh_customer_idx" ON "order_header" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oh_originating_quote_idx" ON "order_header" USING btree ("originating_quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oh_order_date_idx" ON "order_header" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oh_invoice_status_idx" ON "order_header" USING btree ("invoice_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ol_order_idx" ON "order_line" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ol_sku_idx" ON "order_line" USING btree ("sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ol_order_sku_idx" ON "order_line" USING btree ("order_id","sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qh_rep_idx" ON "quote_header" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qh_branch_idx" ON "quote_header" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qh_customer_idx" ON "quote_header" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qh_batch_idx" ON "quote_header" USING btree ("ingest_batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qh_status_idx" ON "quote_header" USING btree ("quote_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ql_quote_idx" ON "quote_line" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ql_option_group_idx" ON "quote_line" USING btree ("option_group");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ql_bucket_idx" ON "quote_line" USING btree ("bucket");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ql_match_status_idx" ON "quote_line" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ql_score_idx" ON "quote_line" USING btree ("score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ql_bucket_score_idx" ON "quote_line" USING btree ("bucket","score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rep_branch_idx" ON "rep" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rep_email_idx" ON "rep" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rep_role_idx" ON "rep" USING btree ("role");