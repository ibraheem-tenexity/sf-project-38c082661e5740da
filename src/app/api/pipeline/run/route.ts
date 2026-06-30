import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runMatch } from "@/lib/pipeline/match";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stages: Record<string, any> = {};

  // F2: Match
  const matchResult = await runMatch();
  stages.match = matchResult;

  return NextResponse.json({ status: "ok", stages });
}
