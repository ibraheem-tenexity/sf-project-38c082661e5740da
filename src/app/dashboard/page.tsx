import { getRequiredSession } from "@/lib/auth-utils";

export default async function DashboardPage() {
  const session = await getRequiredSession();
  return (
    <div className="p-8">
      <h1 className="text-heading-lg font-semibold">Dashboard</h1>
      <p className="text-muted-foreground mt-2">Welcome, {session.user?.name}</p>
      <p className="text-muted-foreground">Role: {(session.user as any).role}</p>
    </div>
  );
}
