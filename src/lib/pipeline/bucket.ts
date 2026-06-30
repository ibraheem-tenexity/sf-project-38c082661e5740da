import { getDb, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

// Non-overridable suppressions (BR-23/24/31): credit-hold + opt-out ALWAYS suppress
// regardless of any config_rule
async function applyHardSuppressions(): Promise<number> {
  const db = getDb();

  // Credit hold suppression (BR-23)
  const creditHoldCustomers = await db
    .select({ customer_id: schema.credit_status.customer_id })
    .from(schema.credit_status)
    .where(eq(schema.credit_status.credit_hold, true));

  let suppressed = 0;
  for (const { customer_id } of creditHoldCustomers) {
    const result = await db.update(schema.quote_line).set({
      bucket: "suppressed",
      suppression_reason: "credit-hold",
    })
    .where(and(
      sql`${schema.quote_line.quote_id} IN (SELECT quote_id FROM quote_header WHERE customer_id = ${customer_id})`,
      sql`${schema.quote_line.bucket} IS NULL`,
      sql`${schema.quote_line.match_status} NOT IN ('won-direct', 'won-likely', 'dead-alternate')`,
    ));
    suppressed++;
  }

  // Opt-out suppression (BR-24)
  const optOutCustomers = await db
    .select({ customer_id: schema.customer_master.customer_id })
    .from(schema.customer_master)
    .where(eq(schema.customer_master.opt_out_flag, true));

  for (const { customer_id } of optOutCustomers) {
    await db.update(schema.quote_line).set({
      bucket: "suppressed",
      suppression_reason: "opt-out",
    })
    .where(and(
      sql`${schema.quote_line.quote_id} IN (SELECT quote_id FROM quote_header WHERE customer_id = ${customer_id})`,
      sql`${schema.quote_line.bucket} IS NULL`,
      sql`${schema.quote_line.match_status} NOT IN ('won-direct', 'won-likely', 'dead-alternate')`,
    ));
    suppressed++;
  }

  return suppressed;
}

async function applyWonSuppressions(): Promise<void> {
  const db = getDb();
  // Already won → suppress
  await db.update(schema.quote_line).set({
    bucket: "suppressed",
    suppression_reason: "won",
  }).where(and(
    sql`${schema.quote_line.match_status} IN ('won-direct', 'won-likely')`,
    sql`${schema.quote_line.bucket} IS NULL`,
  ));
}

async function applyPriceCheckAndDeadAlternateSuppressions(): Promise<void> {
  const db = getDb();
  // Price checks
  await db.update(schema.quote_line).set({
    bucket: "suppressed",
    suppression_reason: "price-check",
  }).where(and(
    sql`${schema.quote_line.intent_class} = 'price-check'`,
    sql`${schema.quote_line.bucket} IS NULL`,
  ));

  // Dead alternates (already set by classify, ensure bucket is set)
  await db.update(schema.quote_line).set({
    bucket: "suppressed",
    suppression_reason: "dead-alternate",
  }).where(and(
    sql`${schema.quote_line.match_status} = 'dead-alternate'`,
    sql`${schema.quote_line.bucket} IS NULL`,
  ));
}

// Assign rep-worked vs automated-long-tail by score (BR-17..19)
async function assignBuckets(): Promise<{ rep_worked: number; automated: number }> {
  const db = getDb();

  // rep-worked: score ≥ 60 (BR-17)
  await db.update(schema.quote_line).set({ bucket: "rep-worked" })
    .where(and(
      sql`${schema.quote_line.bucket} IS NULL`,
      sql`${schema.quote_line.score} >= 60`,
    ));

  // automated-long-tail: score < 60 but not suppressed (BR-18)
  await db.update(schema.quote_line).set({ bucket: "automated-long-tail" })
    .where(and(
      sql`${schema.quote_line.bucket} IS NULL`,
      sql`${schema.quote_line.score} IS NOT NULL`,
    ));

  // Any remaining unscored → suppressed
  await db.update(schema.quote_line).set({
    bucket: "suppressed",
    suppression_reason: "manual",
  }).where(sql`${schema.quote_line.bucket} IS NULL`);

  // Count final buckets
  const [rw] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(schema.quote_line)
    .where(sql`${schema.quote_line.bucket} = 'rep-worked'`);

  const [auto] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(schema.quote_line)
    .where(sql`${schema.quote_line.bucket} = 'automated-long-tail'`);

  return {
    rep_worked: Number(rw?.cnt ?? 0),
    automated: Number(auto?.cnt ?? 0),
  };
}

export async function runBucket(): Promise<{ suppressed: number; rep_worked: number; automated: number }> {
  await applyWonSuppressions();
  const suppressed = await applyHardSuppressions();
  await applyPriceCheckAndDeadAlternateSuppressions();
  const buckets = await assignBuckets();
  return { suppressed, ...buckets };
}
