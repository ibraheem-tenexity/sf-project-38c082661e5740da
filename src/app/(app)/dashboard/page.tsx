import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/lib/db";
import { eq, and, inArray, count, sql } from "drizzle-orm";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const db = getDb();
  const repId = (session.user as any).rep_id as string;
  const role = (session.user as any).role as string;
  const branchId = (session.user as any).branch_id as string | null;

  // KPI: count rep-worked quotes for this rep
  const repWorked = await db
    .select({ cnt: count() })
    .from(schema.quote_line)
    .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
    .where(
      and(
        eq(schema.quote_line.bucket, "rep-worked"),
        role === "network-admin" ? sql`1=1` :
        role === "branch-manager" ? eq(schema.quote_header.branch_id, branchId ?? "") :
        eq(schema.quote_header.rep_id, repId)
      )
    );

  const automatedCount = await db
    .select({ cnt: count() })
    .from(schema.quote_line)
    .where(eq(schema.quote_line.bucket, "automated-long-tail"));

  const suppressedCount = await db
    .select({ cnt: count() })
    .from(schema.quote_line)
    .where(eq(schema.quote_line.bucket, "suppressed"));

  // Top quotes for this rep
  const topQuotes = await db
    .select({
      quote_id: schema.quote_header.quote_id,
      customer_name: schema.customer_master.customer_name,
      total_value: schema.quote_header.total_value,
      quote_date: schema.quote_header.quote_date,
      score: schema.quote_line.score,
      bucket: schema.quote_line.bucket,
    })
    .from(schema.quote_line)
    .innerJoin(schema.quote_header, eq(schema.quote_line.quote_id, schema.quote_header.quote_id))
    .innerJoin(schema.customer_master, eq(schema.quote_header.customer_id, schema.customer_master.customer_id))
    .where(
      and(
        eq(schema.quote_line.bucket, "rep-worked"),
        eq(schema.quote_header.rep_id, repId)
      )
    )
    .orderBy(sql`${schema.quote_line.score} DESC NULLS LAST`)
    .limit(5);

  const kpis = {
    repWorked: repWorked[0]?.cnt ?? 0,
    automated: automatedCount[0]?.cnt ?? 0,
    suppressed: suppressedCount[0]?.cnt ?? 0,
  };

  return (
    <DashboardClient
      session={session}
      kpis={kpis}
      topQuotes={topQuotes.map(q => ({
        quote_id: q.quote_id,
        customer_name: q.customer_name ?? "",
        total_value: Number(q.total_value ?? 0),
        quote_date: q.quote_date ?? "",
        score: q.score ?? 0,
        bucket: q.bucket ?? "",
      }))}
    />
  );
}
