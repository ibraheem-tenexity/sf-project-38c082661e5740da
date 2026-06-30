import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { sql, eq, count } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();

  const [bucketCounts] = await db.select({
    rep_worked: sql<number>`count(*) filter (where ${schema.quote_line.bucket} = 'rep-worked')`,
    automated: sql<number>`count(*) filter (where ${schema.quote_line.bucket} = 'automated-long-tail')`,
    suppressed: sql<number>`count(*) filter (where ${schema.quote_line.bucket} = 'suppressed')`,
    won_direct: sql<number>`count(*) filter (where ${schema.quote_line.match_status} = 'won-direct')`,
    won_likely: sql<number>`count(*) filter (where ${schema.quote_line.match_status} = 'won-likely')`,
    lost: sql<number>`count(*) filter (where ${schema.quote_line.match_status} = 'lost')`,
    price_check: sql<number>`count(*) filter (where ${schema.quote_line.intent_class} = 'price-check')`,
  }).from(schema.quote_line);

  const [latestBatch] = await db
    .select()
    .from(schema.ingest_batch)
    .orderBy(sql`${schema.ingest_batch.uploaded_at} DESC`)
    .limit(1);

  return NextResponse.json({
    bucket_counts: bucketCounts,
    false_loss_rate: latestBatch?.false_loss_rate ?? 0,
    lists_published: latestBatch?.lists_published ?? false,
  });
}
