import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { generateDraft } from "@/lib/ai/draft";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const quoteId = params.id;
  const repId = (session.user as any).rep_id as string;

  const [header] = await db
    .select({
      quote_date: schema.quote_header.quote_date,
      total_value: schema.quote_header.total_value,
      customer_name: schema.customer_master.customer_name,
      customer_tier: schema.customer_master.tier,
      rep_name: schema.rep.rep_name,
    })
    .from(schema.quote_header)
    .innerJoin(schema.customer_master, eq(schema.quote_header.customer_id, schema.customer_master.customer_id))
    .innerJoin(schema.rep, eq(schema.quote_header.rep_id, schema.rep.rep_id))
    .where(eq(schema.quote_header.quote_id, quoteId))
    .limit(1);

  if (!header) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lines = await db
    .select({ sku: schema.quote_line.sku, description: schema.quote_line.description, quantity: schema.quote_line.quantity, unit_price: schema.quote_line.unit_price, score: schema.quote_line.score })
    .from(schema.quote_line)
    .where(eq(schema.quote_line.quote_id, quoteId));

  const topLine = lines[0];
  const draft = await generateDraft({
    quote_id: quoteId,
    customer_name: header.customer_name ?? "",
    customer_tier: header.customer_tier ?? "C",
    rep_name: header.rep_name ?? "Your Rep",
    total_value: parseFloat(header.total_value ?? "0"),
    quote_date: header.quote_date ?? "",
    items: lines.map(l => ({
      sku: l.sku ?? "",
      description: l.description ?? "",
      qty: parseFloat(l.quantity ?? "1"),
      price: parseFloat(l.unit_price ?? "0"),
    })),
    score: topLine?.score ?? 0,
  });

  // Get existing draft version
  const [existing] = await db
    .select({ draft_version: schema.follow_up_record.draft_version, followup_id: schema.follow_up_record.followup_id })
    .from(schema.follow_up_record)
    .where(eq(schema.follow_up_record.quote_id, quoteId))
    .orderBy(sql`${schema.follow_up_record.generated_at} DESC`)
    .limit(1);

  const followupId = uuidv4();
  await db.insert(schema.follow_up_record).values({
    followup_id: followupId,
    quote_id: quoteId,
    rep_id: repId,
    draft_subject: draft.subject,
    draft_body: draft.body,
    draft_version: (existing?.draft_version ?? 0) + 1,
    send_channel: "email",
    outcome: "pending",
  });

  return NextResponse.json({ followup_id: followupId, ...draft });
}
