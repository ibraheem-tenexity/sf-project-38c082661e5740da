import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runMatch } from "@/lib/pipeline/match";
import { runClassify } from "@/lib/pipeline/classify";
import { runScore } from "@/lib/pipeline/score";
import { runBucket } from "@/lib/pipeline/bucket";
import { runMeasure } from "@/lib/pipeline/measure";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stages: Record<string, any> = {};

  // F2: Match
  stages.match = await runMatch();

  // F3: Classify
  stages.classify = await runClassify();

  // F4: Score
  stages.score = await runScore();

  // F5: Bucket + suppress
  stages.bucket = await runBucket();

  // F9: Measure
  stages.measure = await runMeasure();

  return NextResponse.json({ status: "ok", stages });
}
