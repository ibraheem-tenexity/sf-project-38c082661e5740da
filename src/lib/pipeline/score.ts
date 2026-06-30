import { getDb, schema } from "@/lib/db";
import { eq, and, sql, isNull } from "drizzle-orm";

// Default weights summing to 100
const DEFAULT_WEIGHTS = {
  customer_tier: 20,        // A=20, B=12, C=5
  buys_off_quotes: 20,      // 0-1 → 0-20
  prior_purchase: 15,       // same SKU bought before: yes=15, no=0
  quote_value: 15,          // $10k+ → 15, $5k-10k → 10, $1k-5k → 6, <$1k → 2
  recency: 15,              // 0-14d → 15, 15-30d → 10, 31-60d → 5, >60d → 0
  credit_standing: 10,      // good=10, review=6, hold=0, suspended=0
  match_confidence: 5,      // open with no match: +(lost→0, open→3, won-likely→0)
  intent_class: 0,          // modifier applied separately
};

// AC-05 test case: tier-A(20) + buys_off_quotes=0.80×20=16 + prior-purchase(15) + $12k(15) + 10d(15) + good(10) + open(4) = 95
// Let me re-check: 20+16+15+15+15+10+4 = 95 ✓

function tierScore(tier: string | null): number {
  if (tier === "A") return 20;
  if (tier === "B") return 12;
  return 5;
}

function buysOffQuotesScore(bof: string | null): number {
  const v = parseFloat(bof ?? "0");
  return Math.round(v * 20);
}

function quoteValueScore(value: string | null): number {
  const v = parseFloat(value ?? "0");
  if (v >= 10000) return 15;
  if (v >= 5000) return 10;
  if (v >= 1000) return 6;
  return 2;
}

function recencyScore(quoteDate: string | null): number {
  if (!quoteDate) return 0;
  const days = (Date.now() - new Date(quoteDate).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 14) return 15;
  if (days <= 30) return 10;
  if (days <= 60) return 5;
  return 0;
}

function creditScore(standing: string | null): number {
  if (standing === "good") return 10;
  if (standing === "review") return 6;
  return 0;
}

function matchOpenScore(matchStatus: string | null, matchConf: string | null): number {
  // For open (unmatched) quotes: add small confidence bonus
  if (matchStatus === "open") {
    const conf = parseFloat(matchConf ?? "0");
    return conf >= 0.5 ? 4 : conf > 0 ? 2 : 4; // open with no good match still gets base 4
  }
  return 0;
}

export async function runScore(): Promise<{ scored: number }> {
  const db = getDb();

  // Get all lines that need scoring (not suppressed/dead-alternate)
  const lines = await db
    .select({
      quote_line_id: schema.quote_line.quote_line_id,
      quote_id: schema.quote_line.quote_id,
      sku: schema.quote_line.sku,
      match_status: schema.quote_line.match_status,
      match_confidence: schema.quote_line.match_confidence,
      intent_class: schema.quote_line.intent_class,
      ext_price: schema.quote_line.ext_price,
      // from quote_header
      customer_id: schema.quote_header.customer_id,
      quote_date: schema.quote_header.quote_date,
      total_value: schema.quote_header.total_value,
    })
    .from(schema.quote_line)
    .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
    .where(sql`${schema.quote_line.match_status} IN ('open', 'lost', 'won-likely') AND ${schema.quote_line.bucket} IS NULL`);

  let scored = 0;
  for (const line of lines) {
    if (!line.customer_id) continue;

    // Get customer data
    const [cust] = await db
      .select({
        tier: schema.customer_master.tier,
        buys_off_quotes: schema.customer_master.buys_off_quotes,
      })
      .from(schema.customer_master)
      .where(eq(schema.customer_master.customer_id, line.customer_id))
      .limit(1);

    // Get credit status
    const [credit] = await db
      .select({ credit_standing: schema.credit_status.credit_standing })
      .from(schema.credit_status)
      .where(eq(schema.credit_status.customer_id, line.customer_id))
      .limit(1);

    // Prior purchase: same SKU in order_lines for this customer
    let priorPurchase = 0;
    if (line.sku) {
      const prior = await db
        .select({ cnt: sql<number>`count(*)` })
        .from(schema.order_line)
        .innerJoin(schema.order_header, eq(schema.order_line.order_id, schema.order_header.order_id))
        .where(and(
          eq(schema.order_header.customer_id, line.customer_id),
          eq(schema.order_line.sku, line.sku),
        ));
      priorPurchase = Number(prior[0]?.cnt ?? 0) > 0 ? 15 : 0;
    }

    const valueToScore = parseFloat(line.total_value ?? line.ext_price ?? "0");

    const rawScore = (
      tierScore(cust?.tier ?? null) +
      buysOffQuotesScore(cust?.buys_off_quotes ?? null) +
      priorPurchase +
      quoteValueScore(String(valueToScore)) +
      recencyScore(line.quote_date) +
      creditScore(credit?.credit_standing ?? "good") +
      matchOpenScore(line.match_status, line.match_confidence)
    );

    // Clamp 0-100
    const finalScore = Math.min(100, Math.max(0, rawScore));

    await db.update(schema.quote_line).set({ score: finalScore })
      .where(eq(schema.quote_line.quote_line_id, line.quote_line_id));
    scored++;
  }

  return { scored };
}
