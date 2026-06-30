import OpenAI from "openai";
import { getDb, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

// Parse a natural-language rule via OpenRouter → structured logic
export async function parseNLRule(ruleText: string): Promise<{ parsed_logic: any; confidence: number; rejection_reason?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  // Deterministic pattern matching first
  const valueMatch = ruleText.match(/\$?([\d,]+)/);
  const minValue = valueMatch ? parseFloat(valueMatch[1].replace(/,/g, "")) : null;

  if (ruleText.toLowerCase().includes("over") || ruleText.toLowerCase().includes("above") || ruleText.toLowerCase().includes("more than")) {
    if (minValue) {
      return { parsed_logic: { type: "min-value-threshold", min_value: minValue }, confidence: 0.95 };
    }
  }
  if (ruleText.toLowerCase().includes("never") || ruleText.toLowerCase().includes("exclude") || ruleText.toLowerCase().includes("don't") || ruleText.toLowerCase().includes("do not")) {
    return { parsed_logic: { type: "customer-exclusion", pattern: ruleText }, confidence: 0.85 };
  }
  if (ruleText.toLowerCase().includes("email only") || ruleText.toLowerCase().includes("sms only")) {
    const channel = ruleText.toLowerCase().includes("email") ? "email" : "sms";
    return { parsed_logic: { type: "channel-preference", channel }, confidence: 0.90 };
  }
  if (ruleText.toLowerCase().includes("hour") || ruleText.toLowerCase().includes("day") || ruleText.toLowerCase().includes("48")) {
    const hourMatch = ruleText.match(/(\d+)\s*hour/);
    const dayMatch = ruleText.match(/(\d+)\s*day/);
    const hours = hourMatch ? parseInt(hourMatch[1]) : dayMatch ? parseInt(dayMatch[1]) * 24 : 48;
    return { parsed_logic: { type: "cadence-override", hours }, confidence: 0.90 };
  }

  if (!apiKey || apiKey.includes("placeholder")) {
    return { parsed_logic: { type: "unknown", raw: ruleText }, confidence: 0.50, rejection_reason: "Could not parse rule — please rephrase with a specific dollar amount or action." };
  }

  try {
    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: { "HTTP-Referer": process.env.NEXTAUTH_URL ?? "https://ledger.singerindustrial.com", "X-Title": "Ledger for Quotes" },
    });
    const completion = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: `Parse this sales follow-up configuration rule into structured JSON. Return: {"type": one of ["min-value-threshold","customer-exclusion","channel-preference","cadence-override","suppression","scoring-weight"], "params": {}, "confidence": 0-1}` },
        { role: "user", content: ruleText },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });
    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    if (parsed.confidence < 0.80) {
      return { parsed_logic: parsed, confidence: parsed.confidence, rejection_reason: "Low confidence parse — please be more specific (e.g. 'follow up on quotes over $5,000')." };
    }
    return { parsed_logic: parsed, confidence: parsed.confidence };
  } catch {
    return { parsed_logic: { type: "unknown", raw: ruleText }, confidence: 0, rejection_reason: "Failed to parse. Please rephrase." };
  }
}

// Resolve precedence: Individual → Branch → Network (BR-29..32)
export async function resolveRules(repId: string, branchId: string | null): Promise<any[]> {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

  const allRules = await db
    .select()
    .from(schema.config_rule)
    .where(and(
      eq(schema.config_rule.active, true),
      sql`(${schema.config_rule.effective_to} IS NULL OR ${schema.config_rule.effective_to} >= ${now})`,
      sql`${schema.config_rule.effective_from} <= ${now}`,
    ));

  // Precedence map: per rule_type, individual > branch > network
  const ruleMap: Record<string, any> = {};
  for (const rule of allRules) {
    const isForMe =
      (rule.tier === "individual" && rule.owner_id === repId) ||
      (rule.tier === "branch" && rule.owner_id === branchId) ||
      (rule.tier === "network" && rule.owner_id === null);
    if (!isForMe) continue;

    const key = rule.rule_type;
    const tierPriority = { individual: 3, branch: 2, network: 1 }[rule.tier] ?? 0;
    if (!ruleMap[key] || tierPriority > (ruleMap[key]._priority ?? 0)) {
      ruleMap[key] = { ...rule, _priority: tierPriority };
    }
  }

  return Object.values(ruleMap);
}
