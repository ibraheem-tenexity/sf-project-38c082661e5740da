import OpenAI from "openai";

export interface DraftContext {
  quote_id: string;
  customer_name: string;
  customer_tier: string;
  rep_name: string;
  total_value: number;
  quote_date: string;
  items: Array<{ sku: string; description: string; qty: number; price: number }>;
  score: number;
}

export interface Draft {
  subject: string;
  body: string;
}

export async function generateDraft(ctx: DraftContext): Promise<Draft> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const fallback: Draft = {
    subject: `Following up on your quote — ${ctx.customer_name}`,
    body: `Hi,\n\nI wanted to follow up on the quote we sent on ${ctx.quote_date} for $${ctx.total_value.toLocaleString()}.\n\nWe quoted the following items:\n${ctx.items.map(i => `• ${i.description || i.sku} — Qty ${i.qty} @ $${i.price}`).join("\n")}\n\nPlease let me know if you have any questions or if we can adjust anything to better meet your needs.\n\nBest regards,\n${ctx.rep_name}`,
  };

  if (!apiKey || apiKey.includes("placeholder")) return fallback;

  try {
    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL ?? "https://ledger.singerindustrial.com",
        "X-Title": "Ledger for Quotes",
      },
    });

    const itemsList = ctx.items.map(i => `- ${i.description || i.sku}: Qty ${i.qty} at $${i.price} each`).join("\n");

    const completion = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a sales follow-up assistant for Singer Industrial, writing in the voice of ${ctx.rep_name}. Write a brief, professional follow-up email. Be concise (3-4 sentences max). Sound human and warm, not automated. Do not use "I hope this email finds you well." Output JSON with "subject" and "body" fields only.`,
        },
        {
          role: "user",
          content: `Write a follow-up email for: Customer: ${ctx.customer_name} (Tier ${ctx.customer_tier}), Quote from ${ctx.quote_date} for $${ctx.total_value.toLocaleString()}.\nItems:\n${itemsList}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    if (parsed.subject && parsed.body) return parsed as Draft;
    return fallback;
  } catch {
    return fallback;
  }
}
