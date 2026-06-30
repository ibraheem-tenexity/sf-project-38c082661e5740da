"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Session } from "next-auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ListOrdered, BarChart3, Settings, Bot, LogOut, FileText
} from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/worklist", label: "My Quotes", icon: ListOrdered },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/admin", label: "Admin", icon: Settings },
];

export function AppShell({ children, session }: { children: React.ReactNode; session: Session }) {
  const pathname = usePathname();
  const role = (session.user as any).role as string;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-raised flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <div>
              <p className="text-body-md font-semibold text-foreground">Ledger</p>
              <p className="text-xs text-muted-foreground">Quote Follow-Up</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            // Hide Admin from plain reps
            if (href === "/admin" && role === "rep") return null;
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-body-md transition-colors",
                  active
                    ? "bg-brand-soft text-brand font-medium"
                    : "text-muted-foreground hover:bg-sunken hover:text-foreground"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + sign out */}
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-1">
            <p className="text-body-sm font-medium text-foreground truncate">{session.user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{role.replace("-", " ")}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-body-sm text-muted-foreground hover:bg-sunken hover:text-foreground transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
