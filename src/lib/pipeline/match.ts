import { getDb, schema } from "@/lib/db";
import { eq, and, sql, isNotNull, isNull } from "drizzle-orm";

// ── Direct match (BR-01) ─────────────────────────────────────
async function resolveDirectMatches(): Promise<number> {
  const db = getDb();

  // Find quote_lines where quote has an order_reference
  const quoteLinesWithRef = await db
    .select({
      quote_line_id: schema.quote_line.quote_line_id,
      quote_id: schema.quote_line.quote_id,
      sku: schema.quote_line.sku,
      order_reference: schema.quote_header.order_reference,
    })
    .from(schema.quote_line)
    .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
    .where(and(
      isNotNull(schema.quote_header.order_reference),
      isNull(schema.quote_line.match_status),
    ));

  let count = 0;
  for (const ql of quoteLinesWithRef) {
    if (!ql.order_reference) continue;

    // Check if the referenced order has a matching order_line (same SKU or no SKU filter)
    const orderLines = await db
      .select()
      .from(schema.order_line)
      .where(and(
        eq(schema.order_line.order_id, ql.order_reference),
        ql.sku
          ? eq(schema.order_line.sku, ql.sku)
          : sql`1=1`
      ))
      .limit(1);

    if (orderLines.length > 0 || !ql.sku) {
      await db.update(schema.quote_line).set({
        match_status: "won-direct",
        match_order_id: ql.order_reference,
        match_confidence: "1.000",
      }).where(eq(schema.quote_line.quote_line_id, ql.quote_line_id));
      count++;
    }
  }

  // Also: orders with originating_quote_id (BR-01 reverse direction)
  const ordersWithQuoteRef = await db
    .select({
      order_id: schema.order_header.order_id,
      originating_quote_id: schema.order_header.originating_quote_id,
      order_date: schema.order_header.order_date,
    })
    .from(schema.order_header)
    .where(isNotNull(schema.order_header.originating_quote_id));

  for (const ord of ordersWithQuoteRef) {
    if (!ord.originating_quote_id) continue;

    // Get order lines
    const orderLines = await db
      .select()
      .from(schema.order_line)
      .where(eq(schema.order_line.order_id, ord.order_id));

    const orderSkus = new Set(orderLines.map(ol => ol.sku).filter(Boolean));

    // Find quote lines for this quote that aren't yet matched and have matching SKUs
    const quoteLines = await db
      .select()
      .from(schema.quote_line)
      .where(and(
        eq(schema.quote_line.quote_id, ord.originating_quote_id),
        isNull(schema.quote_line.match_status),
      ));

    for (const ql of quoteLines) {
      const matches = !ql.sku || orderSkus.has(ql.sku) || orderSkus.size === 0;
      if (matches) {
        await db.update(schema.quote_line).set({
          match_status: "won-direct",
          match_order_id: ord.order_id,
          match_confidence: "1.000",
        }).where(eq(schema.quote_line.quote_line_id, ql.quote_line_id));
        count++;
      }
    }
  }

  return count;
}

// ── Fuzzy match (BR-02, BR-06) ───────────────────────────────

function skuOverlapScore(quoteSkus: string[], orderSkus: string[]): number {
  if (!quoteSkus.length || !orderSkus.length) return 0;
  const orderSet = new Set(orderSkus);
  const matches = quoteSkus.filter(s => s && orderSet.has(s)).length;
  return matches / Math.max(quoteSkus.length, orderSkus.length);
}

function dateWindowScore(quoteDate: string | null, orderDate: string | null): number {
  if (!quoteDate || !orderDate) return 0;
  const qd = new Date(quoteDate).getTime();
  const od = new Date(orderDate).getTime();
  const daysDiff = (od - qd) / (1000 * 60 * 60 * 24);
  if (daysDiff < 0 || daysDiff > 90) return 0;
  // Score: 1.0 if same day, decays linearly to 0.3 at 90 days
  return Math.max(0.3, 1.0 - (daysDiff / 90) * 0.7);
}

function qtyScore(quoteQty: string | null, orderQty: string | null): number {
  if (!quoteQty || !orderQty) return 0.5; // neutral
  const qQ = parseFloat(quoteQty);
  const oQ = parseFloat(orderQty);
  if (!qQ || !oQ) return 0.5;
  const ratio = Math.min(qQ, oQ) / Math.max(qQ, oQ);
  return ratio >= 0.5 ? ratio : 0; // within ±50% = ≥0.5 ratio
}

async function resolveFuzzyMatches(): Promise<number> {
  const db = getDb();

  // Get all unmatched quote lines
  const unmatchedLines = await db
    .select({
      quote_line_id: schema.quote_line.quote_line_id,
      quote_id: schema.quote_line.quote_id,
      sku: schema.quote_line.sku,
      quantity: schema.quote_line.quantity,
      quote_date: schema.quote_header.quote_date,
      customer_id: schema.quote_header.customer_id,
      quote_status: schema.quote_header.quote_status,
    })
    .from(schema.quote_line)
    .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
    .where(isNull(schema.quote_line.match_status));

  let count = 0;
  for (const ql of unmatchedLines) {
    // Find candidate orders: same customer, order within 0-90 days after quote date
    const candidateOrders = await db
      .select({
        order_id: schema.order_header.order_id,
        order_date: schema.order_header.order_date,
        invoice_status: schema.order_header.invoice_status,
      })
      .from(schema.order_header)
      .where(and(
        eq(schema.order_header.customer_id, ql.customer_id),
        // order_date between quote_date and quote_date + 90 days
        ql.quote_date
          ? sql`${schema.order_header.order_date} >= ${ql.quote_date}::date AND ${schema.order_header.order_date} <= (${ql.quote_date}::date + interval '90 days')`
          : sql`1=1`,
        sql`${schema.order_header.invoice_status} != 'cancelled'`,
      ))
      .limit(20);

    let bestScore = 0;
    let bestOrderId: string | null = null;

    for (const ord of candidateOrders) {
      const orderLines = await db
        .select({ sku: schema.order_line.sku, quantity: schema.order_line.quantity })
        .from(schema.order_line)
        .where(eq(schema.order_line.order_id, ord.order_id));

      const orderSkus = orderLines.map(ol => ol.sku).filter(Boolean) as string[];

      // Composite score: 50% SKU overlap + 30% date window + 20% qty
      const skuScore = ql.sku ? skuOverlapScore([ql.sku], orderSkus) : 0.5;
      const dtScore = dateWindowScore(ql.quote_date, ord.order_date);

      // Find best qty match
      const qtyLine = ql.sku ? orderLines.find(ol => ol.sku === ql.sku) : orderLines[0];
      const qScore = qtyLine ? qtyScore(ql.quantity, qtyLine.quantity) : 0.5;

      const composite = 0.5 * skuScore + 0.3 * dtScore + 0.2 * qScore;

      if (composite > bestScore) {
        bestScore = composite;
        bestOrderId = ord.order_id;
      }
    }

    // Apply BR-06 thresholds
    let matchStatus: string;
    if (bestScore >= 0.75) {
      matchStatus = "won-likely";
    } else if (bestScore >= 0.50) {
      matchStatus = "open";
    } else {
      // No fuzzy match — status depends on quote_status
      matchStatus = ql.quote_status === "closed" || ql.quote_status === "expired" ? "lost" : "open";
      bestOrderId = null;
    }

    await db.update(schema.quote_line).set({
      match_status: matchStatus,
      match_order_id: bestOrderId,
      match_confidence: bestScore > 0 ? bestScore.toFixed(3) : null,
    }).where(eq(schema.quote_line.quote_line_id, ql.quote_line_id));
    count++;
  }

  return count;
}

// ── Public entry point ────────────────────────────────────────
export async function runMatch(): Promise<{ direct: number; fuzzy: number }> {
  const direct = await resolveDirectMatches();
  const fuzzy = await resolveFuzzyMatches();
  return { direct, fuzzy };
}
