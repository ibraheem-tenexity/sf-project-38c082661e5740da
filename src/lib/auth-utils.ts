import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { redirect } from "next/navigation";

export type AppRole = "rep" | "branch-manager" | "network-admin";

export async function getRequiredSession(allowedRoles?: AppRole[]) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (allowedRoles && !allowedRoles.includes((session.user as any).role as AppRole)) {
    redirect("/dashboard");
  }
  return session;
}

export function roleHierarchy(role: string): number {
  const map: Record<string, number> = { "rep": 1, "branch-manager": 2, "network-admin": 3 };
  return map[role] ?? 0;
}

export function canManage(actorRole: string, targetRole: string): boolean {
  return roleHierarchy(actorRole) > roleHierarchy(targetRole);
}

// Role-scoped query helpers
export function repScopeFilter(role: string, repId: string, branchId: string | null) {
  return { role, repId, branchId };
}
