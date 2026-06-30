import { getDb, schema } from "@/lib/db";
import { eq, and, sql, isNull, inArray, count } from "drizzle-orm";

// Dead-alternate: within an option_group of a multi-option quote,
// if ANY line is won-direct or won-likely, all OTHER lines → dead-alternate (BR-07)
async function classifyDeadAlternates(): Promise<number> {
  const db = getDb();

  // Find option groups where at least one line is won
  const wonGroups = await db
    .select({ quote_id: schema.quote_line.quote_id, option_group: schema.quote_line.option_group })
    .from(schema.quote_line)
    .where(and(
      sql`${schema.quote_line.option_group} IS NOT NULL`,
      sql`${schema.quote_line.match_status} IN ('won-direct', 'won-likely')`,
    ));

  if (!wonGroups.length) return 0;

  let count_n = 0;
  for (const { quote_id, option_group } of wonGroups) {
    if (!option_group || !quote_id) continue;
    // Mark other lines in this option_group as dead-alternate
    const result = await db.update(schema.quote_line).set({
      match_status: "dead-alternate",
      suppression_reason: "dead-alternate",
      bucket: "suppressed",
    }).where(and(
      eq(schema.quote_line.quote_id, quote_id),
      eq(schema.quote_line.option_group, option_group),
      sql`${schema.quote_line.match_status} NOT IN ('won-direct', 'won-likely')`,
    ));
    count_n++;
  }
  return count_n;
}

// Price-check detection (BR-08..11): ≥2 signals
// Signal 1: same customer+SKU quoted ≥2 times within 60 days with no order
// Signal 2: rep price-check rate >40% (based on ratio of low-converting quotes)
// Signal 3: commodity SKU (same SKU quoted by >3 different customers with low conversion)
async function classifyPriceChecks(): Promise<number> {
  const db = getDb();

  // Get all unclassified open quote lines
  const openLines = await db
    .select({
      quote_line_id: schema.quote_line.quote_line_id,
      quote_id: schema.quote_line.quote_id,
      sku: schema.quote_line.sku,
      customer_id: schema.quote_header.customer_id,
      rep_id: schema.quote_header.rep_id,
      quote_date: schema.quote_header.quote_date,
      match_status: schema.quote_line.match_status,
    })
    .from(schema.quote_line)
    .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
    .where(and(
      sql`${schema.quote_line.intent_class} IS NULL`,
      sql`${schema.quote_line.match_status} IN ('open', 'lost')`,
    ));

  let priceCheckCount = 0;

  for (const line of openLines) {
    let signals = 0;

    // Signal 1: same customer+SKU quoted ≥2 times in 60 days with no won outcome
    if (line.sku && line.quote_date && line.customer_id) {
      const dupQuotes = await db
        .select({ cnt: sql<number>`count(*)` })
        .from(schema.quote_line)
        .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
        .where(and(
          eq(schema.quote_header.customer_id, line.customer_id),
          eq(schema.quote_line.sku, line.sku),
          sql`${schema.quote_header.quote_date} >= (${line.quote_date}::date - interval '60 days')`,
          sql`${schema.quote_line.match_status} NOT IN ('won-direct', 'won-likely')`,
        ));
      if (Number(dupQuotes[0]?.cnt ?? 0) >= 2) signals++;
    }

    // Signal 2: rep price-check rate (buys_off_quotes < 0.15 for this customer)
    const custData = line.customer_id ? await db
      .select({ buys_off_quotes: schema.customer_master.buys_off_quotes })
      .from(schema.customer_master)
      .where(eq(schema.customer_master.customer_id, line.customer_id))
      .limit(1) : [];

    const bof = parseFloat(custData[0]?.buys_off_quotes ?? "0.5");
    if (bof < 0.15) signals++;

    // Signal 3: commodity SKU (quoted by many customers, low overall conversion)
    if (line.sku) {
      const skuStats = await db
        .select({
          total: sql<number>`count(distinct ${schema.quote_header.customer_id})`,
        })
        .from(schema.quote_line)
        .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
        .where(eq(schema.quote_line.sku, line.sku));
      if (Number(skuStats[0]?.total ?? 0) > 3) signals++;
    }

    // ≥2 signals → price-check
    const intentClass = signals >= 2 ? "price-check" : "real-quote";
    await db.update(schema.quote_line).set({ intent_class: intentClass })
      .where(eq(schema.quote_line.quote_line_id, line.quote_line_id));

    if (intentClass === "price-check") priceCheckCount++;
  }

  // Mark already-won lines as real-quote
  await db.update(schema.quote_line).set({ intent_class: "real-quote" })
    .where(and(
      sql`${schema.quote_line.intent_class} IS NULL`,
      sql`${schema.quote_line.match_status} IN ('won-direct', 'won-likely', 'dead-alternate')`,
    ));

  return priceCheckCount;
}

export async function runClassify(): Promise<{ dead_alternates: number; price_checks: number }> {
  const dead_alternates = await classifyDeadAlternates();
  const price_checks = await classifyPriceChecks();
  return { dead_alternates, price_checks };
}
