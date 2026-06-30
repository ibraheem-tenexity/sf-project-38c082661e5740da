import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // This route orchestrates the full pipeline.
  // Subsequent tickets (TKT-002..007) add stages to this route.
  // For now, return a stub that subsequent tickets will fill in.
  return NextResponse.json({
    status: "ok",
    message: "Pipeline run complete",
    stages: []
  });
}
