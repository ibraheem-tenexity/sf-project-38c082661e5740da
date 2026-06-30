import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WorklistClient } from "@/components/worklist/worklist-client";

export default async function WorklistPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-heading-lg font-semibold text-foreground">My Quotes</h1>
        <p className="text-body-md text-muted-foreground">Follow-up worklist — ranked by priority score</p>
      </div>
      <Suspense fallback={<div className="agent-at-work h-48 rounded-lg" />}>
        <WorklistClient />
      </Suspense>
    </div>
  );
}
