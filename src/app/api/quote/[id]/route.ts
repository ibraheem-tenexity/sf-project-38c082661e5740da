import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const quoteId = params.id;

  const [header] = await db
    .select({
      quote_id: schema.quote_header.quote_id,
      quote_date: schema.quote_header.quote_date,
      quote_status: schema.quote_header.quote_status,
      total_value: schema.quote_header.total_value,
      multi_option_flag: schema.quote_header.multi_option_flag,
      customer_id: schema.customer_master.customer_id,
      customer_name: schema.customer_master.customer_name,
      customer_tier: schema.customer_master.tier,
      customer_email: schema.customer_master.contact_email,
      rep_id: schema.rep.rep_id,
      rep_name: schema.rep.rep_name,
      rep_email: schema.rep.email,
      branch_id: schema.branch.branch_id,
      branch_name: schema.branch.branch_name,
    })
    .from(schema.quote_header)
    .innerJoin(schema.customer_master, eq(schema.quote_header.customer_id, schema.customer_master.customer_id))
    .innerJoin(schema.rep, eq(schema.quote_header.rep_id, schema.rep.rep_id))
    .innerJoin(schema.branch, eq(schema.quote_header.branch_id, schema.branch.branch_id))
    .where(eq(schema.quote_header.quote_id, quoteId))
    .limit(1);

  if (!header) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lines = await db
    .select()
    .from(schema.quote_line)
    .where(eq(schema.quote_line.quote_id, quoteId));

  // Get existing draft if any
  const [draft] = await db
    .select()
    .from(schema.follow_up_record)
    .where(eq(schema.follow_up_record.quote_id, quoteId))
    .orderBy(sql`${schema.follow_up_record.generated_at} DESC`)
    .limit(1);

  return NextResponse.json({ header, lines, draft: draft ?? null });
}
