"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus } from "lucide-react";

interface ConfigRule {
  rule_id: string;
  tier: string;
  owner_id: string | null;
  rule_text: string;
  rule_type: string;
  parsed_logic: any;
  active: boolean;
  created_at: string;
}

const TIER_COLORS: Record<string, string> = {
  network: "default",
  branch: "secondary",
  individual: "outline",
};

export default function AdminPage() {
  const [rules, setRules] = useState<ConfigRule[]>([]);
  const [newRule, setNewRule] = useState("");
  const [newTier, setNewTier] = useState<"network" | "branch" | "individual">("individual");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/config/rules")
      .then(r => r.json())
      .then(d => { setRules(d.rules ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function addRule() {
    if (!newRule.trim()) return;
    setSaving(true); setError("");
    const res = await fetch("/api/config/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: newTier, rule_text: newRule }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to save rule"); setSaving(false); return; }
    setRules(prev => [...prev, { rule_id: data.rule_id, tier: newTier, owner_id: null, rule_text: newRule, rule_type: data.parsed_logic?.type ?? "unknown", parsed_logic: data.parsed_logic, active: true, created_at: new Date().toISOString() }]);
    setNewRule("");
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-brand" />
        <div>
          <h1 className="text-heading-lg font-semibold">Configuration</h1>
          <p className="text-body-md text-muted-foreground">3-tier follow-up rules in plain English</p>
        </div>
      </div>

      {/* Add rule */}
      <Card>
        <CardHeader><CardTitle className="text-heading-md flex items-center gap-2"><Plus size={16} />Add Rule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(["network", "branch", "individual"] as const).map(t => (
              <button
                key={t}
                onClick={() => setNewTier(t)}
                className={`px-3 py-1.5 rounded-lg text-body-sm font-medium transition-colors border ${
                  newTier === t ? "bg-brand text-brand-foreground border-brand" : "border-border text-muted-foreground hover:bg-sunken"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Rule (plain English)</Label>
            <Input
              placeholder="e.g. Follow up on any quote over $5,000"
              value={newRule}
              onChange={e => setNewRule(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addRule()}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={addRule} disabled={saving || !newRule.trim()} size="sm">
            {saving ? "Parsing..." : "Add Rule"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing rules */}
      <Card>
        <CardHeader><CardTitle className="text-heading-md">Active Rules</CardTitle></CardHeader>
        <CardContent>
          {loading && <div className="agent-at-work h-24 rounded-md" />}
          {!loading && rules.length === 0 && <p className="text-muted-foreground text-body-sm">No rules configured yet.</p>}
          <div className="divide-y divide-border">
            {rules.map(rule => (
              <div key={rule.rule_id} className="py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={TIER_COLORS[rule.tier] as any}>{rule.tier}</Badge>
                    <span className="text-xs text-muted-foreground">{rule.rule_type}</span>
                  </div>
                  <p className="text-body-md text-foreground">{rule.rule_text}</p>
                  {rule.parsed_logic && (
                    <p className="text-xs text-muted-foreground mt-1">Parsed: {JSON.stringify(rule.parsed_logic)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Run pipeline */}
      <Card>
        <CardHeader><CardTitle className="text-heading-md">Pipeline</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-body-sm text-muted-foreground">Re-run the scoring pipeline to apply new rules.</p>
          <Button
            variant="outline"
            onClick={async () => {
              const res = await fetch("/api/pipeline/run", { method: "POST" });
              const d = await res.json();
              alert("Pipeline complete: " + JSON.stringify(d.stages ?? {}));
            }}
          >
            Run Pipeline
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
