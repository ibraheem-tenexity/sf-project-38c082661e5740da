import { getDb, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

export async function runMeasure(): Promise<{ false_loss_rate: number; lists_published: boolean }> {
  const db = getDb();

  // False-loss rate: proportion of won-likely/(won-likely+lost)
  // A "false loss" is a quote that looks lost but was actually won (won-likely)
  const [stats] = await db.select({
    won_likely: sql<number>`count(*) filter (where ${schema.quote_line.match_status} = 'won-likely')`,
    lost: sql<number>`count(*) filter (where ${schema.quote_line.match_status} = 'lost')`,
    total: sql<number>`count(*)`,
  }).from(schema.quote_line);

  const wonLikely = Number(stats?.won_likely ?? 0);
  const lost = Number(stats?.lost ?? 0);
  const falseLossRate = (wonLikely + lost) > 0 ? wonLikely / (wonLikely + lost) : 0;

  // Gate: >15% false-loss rate → don't publish (AC-09)
  const listsPublished = falseLossRate <= 0.15;

  // Update the latest ingest_batch
  const [latestBatch] = await db
    .select({ ingest_batch_id: schema.ingest_batch.ingest_batch_id })
    .from(schema.ingest_batch)
    .orderBy(sql`${schema.ingest_batch.uploaded_at} DESC`)
    .limit(1);

  if (latestBatch) {
    await db.update(schema.ingest_batch).set({
      false_loss_rate: falseLossRate.toFixed(4),
      lists_published: listsPublished,
    }).where(eq(schema.ingest_batch.ingest_batch_id, latestBatch.ingest_batch_id));
  }

  return { false_loss_rate: falseLossRate, lists_published: listsPublished };
}
