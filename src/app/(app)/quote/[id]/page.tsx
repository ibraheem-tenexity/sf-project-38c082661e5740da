import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuoteDetailClient } from "@/components/quote/quote-detail-client";

export default async function QuotePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <QuoteDetailClient quoteId={params.id} session={session} />;
}
