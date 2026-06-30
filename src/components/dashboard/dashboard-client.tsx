"use client";

import { Session } from "next-auth";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListOrdered, Bot, TrendingUp } from "lucide-react";

interface KPIs { repWorked: number; automated: number; suppressed: number; }
interface TopQuote { quote_id: string; customer_name: string; total_value: number; quote_date: string; score: number; bucket: string; }

export function DashboardClient({ session, kpis, topQuotes }: { session: Session; kpis: KPIs; topQuotes: TopQuote[] }) {
  const [brief, setBrief] = useState<string>("");
  const [briefLoading, setBriefLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai/brief")
      .then(r => r.json())
      .then(d => { setBrief(d.brief ?? ""); setBriefLoading(false); })
      .catch(() => { setBrief("Unable to load daily brief."); setBriefLoading(false); });
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-heading-lg font-semibold text-foreground">Dashboard</h1>
        <p className="text-body-md text-muted-foreground">Good morning, {session.user?.name}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-soft">
                <ListOrdered size={20} className="text-brand" />
              </div>
              <div>
                <p className="text-display-md font-display tabular text-foreground">{kpis.repWorked}</p>
                <p className="text-body-sm text-muted-foreground">Rep-Worked Quotes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: "hsl(var(--info-soft))" }}>
                <TrendingUp size={20} style={{ color: "hsl(var(--info))" }} />
              </div>
              <div>
                <p className="text-display-md font-display tabular text-foreground">{kpis.automated}</p>
                <p className="text-body-sm text-muted-foreground">Auto Long-Tail</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
                <Bot size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-display-md font-display tabular text-foreground">{kpis.suppressed}</p>
                <p className="text-body-sm text-muted-foreground">Suppressed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* AI Daily Brief */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-heading-md">
              <Bot size={18} className="text-brand" />
              AI Daily Brief
            </CardTitle>
          </CardHeader>
          <CardContent>
            {briefLoading ? (
              <div className="agent-at-work h-16 rounded-md" />
            ) : (
              <p className="text-body-md text-foreground whitespace-pre-wrap">{brief}</p>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full" size="sm">
              <Link href="/worklist">View My Quotes ({kpis.repWorked})</Link>
            </Button>
            <Button asChild variant="outline" className="w-full" size="sm">
              <Link href="/insights">View Insights</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Top priority quotes */}
      {topQuotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">Top Priority Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {topQuotes.map(q => (
                <Link
                  key={q.quote_id}
                  href={`/quote/${q.quote_id}`}
                  className="flex items-center justify-between py-3 hover:bg-sunken -mx-2 px-2 rounded transition-colors"
                >
                  <div>
                    <p className="text-body-md font-medium text-foreground">{q.customer_name}</p>
                    <p className="text-body-sm text-muted-foreground">{q.quote_id} · {q.quote_date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-body-md font-semibold tabular text-foreground">
                      ${q.total_value.toLocaleString()}
                    </span>
                    <Badge variant={q.score >= 80 ? "success" : q.score >= 60 ? "default" : "secondary"}>
                      Score {q.score}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
