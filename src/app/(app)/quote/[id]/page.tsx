export default function QuotePage({ params }: { params: { id: string } }) {
  return <div className="p-6"><h1 className="text-heading-lg font-semibold">Quote {params.id}</h1><p className="text-muted-foreground mt-2">Quote detail coming in TKT-009.</p></div>;
}
