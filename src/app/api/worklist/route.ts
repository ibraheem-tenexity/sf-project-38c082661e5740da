import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, sql, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const repId = (session.user as any).rep_id as string;
  const role = (session.user as any).role as string;
  const branchId = (session.user as any).branch_id as string | null;

  const db = getDb();

  // Role-scoped filter
  let repFilter;
  if (role === "network-admin") {
    repFilter = sql`1=1`;
  } else if (role === "branch-manager" && branchId) {
    repFilter = eq(schema.quote_header.branch_id, branchId);
  } else {
    repFilter = eq(schema.quote_header.rep_id, repId);
  }

  const bucket = req.nextUrl.searchParams.get("bucket") ?? "rep-worked";

  const rows = await db
    .select({
      quote_line_id: schema.quote_line.quote_line_id,
      quote_id: schema.quote_header.quote_id,
      customer_name: schema.customer_master.customer_name,
      customer_tier: schema.customer_master.tier,
      rep_name: schema.rep.rep_name,
      quote_date: schema.quote_header.quote_date,
      total_value: schema.quote_header.total_value,
      score: schema.quote_line.score,
      bucket: schema.quote_line.bucket,
      match_status: schema.quote_line.match_status,
      intent_class: schema.quote_line.intent_class,
      suppression_reason: schema.quote_line.suppression_reason,
      sku: schema.quote_line.sku,
      description: schema.quote_line.description,
      ext_price: schema.quote_line.ext_price,
    })
    .from(schema.quote_line)
    .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
    .innerJoin(schema.customer_master, eq(schema.quote_header.customer_id, schema.customer_master.customer_id))
    .innerJoin(schema.rep, eq(schema.quote_header.rep_id, schema.rep.rep_id))
    .where(and(repFilter, eq(schema.quote_line.bucket, bucket)))
    .orderBy(desc(schema.quote_line.score))
    .limit(100);

  return NextResponse.json({ quotes: rows });
}
