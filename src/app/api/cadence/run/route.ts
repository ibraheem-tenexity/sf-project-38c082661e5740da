import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { generateDraft } from "@/lib/ai/draft";
import { v4 as uuidv4 } from "uuid";

// Runs the automated long-tail cadence (BR-26/28):
// generates drafts for automated-long-tail quotes not yet followed up, marks as sent

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role === "rep") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const CADENCE_HOURS = 48; // BR-28: 48-hour default

  // Find automated-long-tail quote lines with no recent follow-up
  const cutoff = new Date(Date.now() - CADENCE_HOURS * 60 * 60 * 1000).toISOString();

  const autoLines = await db
    .select({
      quote_line_id: schema.quote_line.quote_line_id,
      quote_id: schema.quote_header.quote_id,
      customer_name: schema.customer_master.customer_name,
      customer_tier: schema.customer_master.tier,
      customer_email: schema.customer_master.contact_email,
      rep_id: schema.quote_header.rep_id,
      rep_name: schema.rep.rep_name,
      rep_email: schema.rep.email,
      quote_date: schema.quote_header.quote_date,
      total_value: schema.quote_header.total_value,
      sku: schema.quote_line.sku,
      description: schema.quote_line.description,
      quantity: schema.quote_line.quantity,
      unit_price: schema.quote_line.unit_price,
      score: schema.quote_line.score,
    })
    .from(schema.quote_line)
    .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
    .innerJoin(schema.customer_master, eq(schema.quote_header.customer_id, schema.customer_master.customer_id))
    .innerJoin(schema.rep, eq(schema.quote_header.rep_id, schema.rep.rep_id))
    .where(and(
      eq(schema.quote_line.bucket, "automated-long-tail"),
      sql`NOT EXISTS (SELECT 1 FROM follow_up_record fur WHERE fur.quote_id = ${schema.quote_header.quote_id} AND fur.generated_at > ${cutoff})`,
    ))
    .limit(50);

  const processed: string[] = [];
  for (const line of autoLines) {
    if (!line.customer_email) continue; // no contact → skip

    const draft = await generateDraft({
      quote_id: line.quote_id,
      customer_name: line.customer_name ?? "",
      customer_tier: line.customer_tier ?? "C",
      rep_name: line.rep_name ?? "Singer Industrial",
      total_value: parseFloat(line.total_value ?? "0"),
      quote_date: line.quote_date ?? "",
      items: [{ sku: line.sku ?? "", description: line.description ?? "", qty: parseFloat(line.quantity ?? "1"), price: parseFloat(line.unit_price ?? "0") }],
      score: line.score ?? 0,
    });

    const followupId = uuidv4();
    await db.insert(schema.follow_up_record).values({
      followup_id: followupId,
      quote_id: line.quote_id,
      rep_id: line.rep_id ?? "",
      draft_subject: draft.subject,
      draft_body: draft.body,
      draft_version: 1,
      send_channel: "email",
      outcome: "sent",
      automated_flag: true,
      outcome_recorded_at: new Date(),
    });

    processed.push(line.quote_id);
  }

  return NextResponse.json({ processed: processed.length, quote_ids: processed });
}
