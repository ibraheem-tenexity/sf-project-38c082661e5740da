import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ingest } from "@/lib/pipeline/ingest";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "network-admin" && role !== "branch-manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const files: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      files[key] = await value.text();
    }
  }

  const result = await ingest(files as any, (session.user as any).rep_id);
  return NextResponse.json(result);
}
