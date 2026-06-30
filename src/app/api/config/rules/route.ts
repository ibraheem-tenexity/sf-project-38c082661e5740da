import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { parseNLRule } from "@/lib/pipeline/config";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const CreateRuleBody = z.object({
  tier: z.enum(["network", "branch", "individual"]),
  owner_id: z.string().nullable().optional(),
  rule_text: z.string().min(5),
  rule_type: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rules = await db.select().from(schema.config_rule).orderBy(schema.config_rule.created_at);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const repId = (session.user as any).rep_id;

  const body = CreateRuleBody.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  // Permission check: only admin can set network rules, manager can set branch, all can set individual
  if (body.data.tier === "network" && role !== "network-admin") {
    return NextResponse.json({ error: "Only network admins can set network rules" }, { status: 403 });
  }
  if (body.data.tier === "branch" && role === "rep") {
    return NextResponse.json({ error: "Only managers and admins can set branch rules" }, { status: 403 });
  }

  // Parse the NL rule
  const { parsed_logic, confidence, rejection_reason } = await parseNLRule(body.data.rule_text);
  if (confidence < 0.80 && rejection_reason) {
    return NextResponse.json({ error: rejection_reason, confidence }, { status: 422 });
  }

  const db = getDb();
  const ruleId = uuidv4();
  await db.insert(schema.config_rule).values({
    rule_id: ruleId,
    tier: body.data.tier,
    owner_id: body.data.owner_id ?? null,
    rule_text: body.data.rule_text,
    rule_type: body.data.rule_type ?? (parsed_logic.type ?? "suppression"),
    parsed_logic,
    active: true,
    created_by: repId,
    effective_from: new Date().toISOString().split("T")[0],
  });

  return NextResponse.json({ rule_id: ruleId, parsed_logic, confidence });
}
