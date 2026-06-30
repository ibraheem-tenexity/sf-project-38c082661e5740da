"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, AlertTriangle, CheckCircle } from "lucide-react";

interface InsightData {
  bucket_counts: {
    rep_worked: number;
    automated: number;
    suppressed: number;
    won_direct: number;
    won_likely: number;
    lost: number;
    price_check: number;
  };
  false_loss_rate: number;
  lists_published: boolean;
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/insights")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(load, []);

  async function publishLists() {
    setPublishing(true);
    await fetch("/api/pipeline/run", { method: "POST" });
    load();
    setPublishing(false);
  }

  if (loading) return <div className="p-6"><div className="agent-at-work h-48 rounded-lg" /></div>;

  const bc = data?.bucket_counts;
  const falseLossRate = typeof data?.false_loss_rate === "string" ? parseFloat(data.false_loss_rate) : (data?.false_loss_rate ?? 0);
  const isHighFalseLoss = falseLossRate > 0.15;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-brand" />
          <div>
            <h1 className="text-heading-lg font-semibold">Insights</h1>
            <p className="text-body-md text-muted-foreground">Pipeline results and coverage metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isHighFalseLoss && (
            <div className="flex items-center gap-2 text-warning text-body-sm">
              <AlertTriangle size={16} />
              High false-loss rate — lists not published
            </div>
          )}
          {data?.lists_published && (
            <div className="flex items-center gap-2 text-success text-body-sm">
              <CheckCircle size={16} />
              Lists published
            </div>
          )}
          <Button onClick={publishLists} disabled={publishing} variant={isHighFalseLoss ? "outline" : "default"} size="sm">
            {publishing ? "Running..." : "Re-run Pipeline"}
          </Button>
        </div>
      </div>

      {/* False-loss rate banner */}
      {isHighFalseLoss && (
        <Card className="border-warning">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-warning" />
              <div>
                <p className="text-body-md font-semibold">False-Loss Rate: {(falseLossRate * 100).toFixed(1)}%</p>
                <p className="text-body-sm text-muted-foreground">Rate exceeds 15% threshold (AC-09). Lists are NOT published to reps. Review match logic and re-run.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bucket KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Rep-Worked", value: bc?.rep_worked ?? 0, variant: "default" as const },
          { label: "Automated", value: bc?.automated ?? 0, variant: "secondary" as const },
          { label: "Suppressed", value: bc?.suppressed ?? 0, variant: "secondary" as const },
          { label: "Price-Check", value: bc?.price_check ?? 0, variant: "secondary" as const },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-display-md font-display tabular text-foreground">{value}</p>
              <p className="text-body-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Win/loss breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-heading-md">Win / Loss Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-display-md font-display tabular" style={{ color: "hsl(var(--success))" }}>{bc?.won_direct ?? 0}</p>
              <p className="text-body-sm text-muted-foreground">Won Direct</p>
            </div>
            <div>
              <p className="text-display-md font-display tabular" style={{ color: "hsl(var(--info))" }}>{bc?.won_likely ?? 0}</p>
              <p className="text-body-sm text-muted-foreground">Won Likely (fuzzy)</p>
            </div>
            <div>
              <p className="text-display-md font-display tabular" style={{ color: "hsl(var(--danger))" }}>{bc?.lost ?? 0}</p>
              <p className="text-body-sm text-muted-foreground">Lost</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* False loss rate */}
      <Card>
        <CardHeader><CardTitle className="text-heading-md">False-Loss Rate (AC-09)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <p className={`text-display-md font-display tabular ${isHighFalseLoss ? "text-warning" : "text-success"}`}>
              {(falseLossRate * 100).toFixed(1)}%
            </p>
            <div>
              <p className="text-body-md">{isHighFalseLoss ? "Above threshold" : "Within threshold"}</p>
              <p className="text-body-sm text-muted-foreground">Target: ≤15% | Lists {data?.lists_published ? "published ✓" : "NOT published"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
