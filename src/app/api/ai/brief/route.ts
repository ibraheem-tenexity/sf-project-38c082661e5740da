import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, count, sql } from "drizzle-orm";
import OpenAI from "openai";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const repId = (session.user as any).rep_id as string;

  try {
    const db = getDb();
    const repWorked = await db
      .select({ cnt: count() })
      .from(schema.quote_line)
      .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
      .where(sql`${schema.quote_line.bucket} = 'rep-worked' AND ${schema.quote_header.rep_id} = ${repId}`);

    const count_val = repWorked[0]?.cnt ?? 0;

    // Try OpenRouter; fall back to scripted brief
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey && !apiKey.includes("placeholder")) {
      const client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXTAUTH_URL ?? "https://ledger.singerindustrial.com",
          "X-Title": "Ledger for Quotes",
        },
      });
      const completion = await client.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a sales AI assistant for Singer Industrial. Write a concise 2-3 sentence daily brief for a sales rep. Mention the number of quotes to follow up on and encourage action.",
          },
          {
            role: "user",
            content: `The rep has ${count_val} quotes in their rep-worked worklist today. Generate a motivating daily brief.`,
          },
        ],
        max_tokens: 150,
      });
      return NextResponse.json({ brief: completion.choices[0].message.content });
    }

    // Scripted fallback
    const brief = `You have ${count_val} quote${count_val !== 1 ? "s" : ""} in your follow-up worklist today. Your top-priority quotes are ready for review — a timely follow-up can make the difference between a win and a lost opportunity. Let's close some business!`;
    return NextResponse.json({ brief });
  } catch (e) {
    return NextResponse.json({ brief: "Your quote follow-up worklist is ready. Check your top-priority quotes and reach out today." });
  }
}
