import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const OutcomeBody = z.object({
  outcome: z.enum(["won", "lost", "not-interested", "already-handled", "suppressed"]),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = OutcomeBody.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });

  const db = getDb();
  const now = new Date();

  await db.update(schema.follow_up_record).set({
    outcome: body.data.outcome,
    outcome_recorded_at: now,
    outcome_recorded_by: (session.user as any).rep_id,
  }).where(eq(schema.follow_up_record.followup_id, params.id));

  return NextResponse.json({ ok: true });
}
