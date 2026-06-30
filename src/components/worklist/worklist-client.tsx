"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Clock, User, DollarSign } from "lucide-react";

interface QuoteRow {
  quote_line_id: string;
  quote_id: string;
  customer_name: string;
  customer_tier: string;
  rep_name: string;
  quote_date: string;
  total_value: string;
  score: number;
  bucket: string;
  match_status: string;
  intent_class: string;
  sku: string;
  description: string;
  ext_price: string;
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 80 ? "success" : score >= 60 ? "default" : "secondary";
  return <Badge variant={variant}>Score {score}</Badge>;
}

function TierBadge({ tier }: { tier: string }) {
  const colors = {
    A: "bg-brand text-brand-foreground",
    B: "bg-warning text-warning-foreground",
    C: "bg-secondary text-secondary-foreground",
  };
  const cls = colors[tier as keyof typeof colors] ?? colors.C;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {tier}
    </span>
  );
}

function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const TABS = [
  { id: "rep-worked", label: "Rep-Worked" },
  { id: "automated-long-tail", label: "Automated" },
];

export function WorklistClient() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("rep-worked");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/worklist?bucket=${activeTab}`)
      .then(r => r.json())
      .then(d => { setQuotes(d.quotes ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-3">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-t-lg text-body-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-brand-soft text-brand border-b-2 border-brand"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="agent-at-work h-48 rounded-lg" />}

      {!loading && quotes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No quotes in this bucket.</p>
          </CardContent>
        </Card>
      )}

      {!loading && quotes.map((q, i) => (
        <Link key={q.quote_line_id} href={`/quote/${q.quote_id}`}>
          <Card className="hover:border-brand transition-colors cursor-pointer mb-3">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Rank + info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Rank circle */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center text-brand text-body-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-body-md font-semibold text-foreground">{q.customer_name}</span>
                      <TierBadge tier={q.customer_tier} />
                    </div>
                    <p className="text-body-sm text-muted-foreground truncate">{q.description || q.sku || q.quote_id}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={12} />
                        {daysSince(q.quote_date)}d ago
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User size={12} />
                        {q.rep_name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Value + score */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-body-md font-semibold tabular text-foreground">
                      ${parseFloat(q.total_value ?? "0").toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">{q.match_status}</p>
                  </div>
                  <ScoreBadge score={q.score} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
