"use client";

import { Session } from "next-auth";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Bot, Send, CheckCircle, RefreshCw } from "lucide-react";

interface QuoteHeader {
  quote_id: string;
  quote_date: string;
  quote_status: string;
  total_value: string;
  customer_name: string;
  customer_tier: string;
  customer_email: string;
  rep_name: string;
  rep_email: string;
  branch_name: string;
}

interface QuoteLine {
  quote_line_id: string;
  line_number: number;
  sku: string;
  description: string;
  quantity: string;
  unit_price: string;
  ext_price: string;
  score: number;
  bucket: string;
  match_status: string;
  intent_class: string;
  suppression_reason: string;
}

interface Draft {
  followup_id: string;
  subject: string;
  body: string;
}

const OUTCOME_LABELS: Record<string, string> = {
  won: "Won",
  lost: "Lost",
  "not-interested": "Not Interested",
  "already-handled": "Already Handled",
};

export function QuoteDetailClient({ quoteId, session }: { quoteId: string; session: Session }) {
  const [header, setHeader] = useState<QuoteHeader | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftLoading, setDraftLoading] = useState(false);
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);
  const [outcomeSet, setOutcomeSet] = useState<string | null>(null);
  const [sendIntentFired, setSendIntentFired] = useState(false);

  useEffect(() => {
    fetch(`/api/quote/${quoteId}`)
      .then(r => r.json())
      .then(d => {
        setHeader(d.header);
        setLines(d.lines ?? []);
        if (d.draft) setDraft(d.draft);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [quoteId]);

  async function generateDraft() {
    setDraftLoading(true);
    const res = await fetch(`/api/quote/${quoteId}/draft`, { method: "POST" });
    const data = await res.json();
    setDraft(data);
    setDraftLoading(false);
  }

  async function handleSendViaOutlook() {
    if (!draft || !header) return;
    // Build mailto: deep link (F7 click-to-send, client-side only)
    const toEmail = header.customer_email || "";
    const subject = encodeURIComponent(draft.subject);
    const body = encodeURIComponent(draft.body);
    const mailtoUrl = `mailto:${toEmail}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, "_blank");

    // Record send intent
    if (draft.followup_id) {
      await fetch(`/api/followup/${draft.followup_id}/send-intent`, { method: "POST" });
      setSendIntentFired(true);
    }
  }

  async function handleOutcome(outcome: string) {
    if (!draft?.followup_id) return;
    setOutcomeSubmitting(true);
    await fetch(`/api/followup/${draft.followup_id}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    setOutcomeSet(outcome);
    setOutcomeSubmitting(false);
  }

  if (loading) return <div className="p-6"><div className="agent-at-work h-48 rounded-lg" /></div>;
  if (!header) return <div className="p-6"><p className="text-muted-foreground">Quote not found.</p></div>;

  const topLine = lines[0];
  const score = topLine?.score ?? 0;
  const bucket = topLine?.bucket;
  const isSuppressed = bucket === "suppressed";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back nav */}
      <Link href="/worklist" className="flex items-center gap-2 text-body-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={16} /> Back to Worklist
      </Link>

      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-heading-lg">{header.customer_name}</CardTitle>
              <p className="text-body-md text-muted-foreground mt-1">{header.quote_id} · {header.quote_date}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={header.customer_tier === "A" ? "default" : "secondary"}>Tier {header.customer_tier}</Badge>
              {score > 0 && <Badge variant={score >= 80 ? "success" : score >= 60 ? "default" : "secondary"}>Score {score}</Badge>}
              {isSuppressed && <Badge variant="secondary">Suppressed: {topLine?.suppression_reason}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-body-sm">
            <div><span className="text-muted-foreground">Total Value</span><p className="font-semibold text-heading-sm">${parseFloat(header.total_value ?? "0").toLocaleString()}</p></div>
            <div><span className="text-muted-foreground">Status</span><p className="font-semibold">{header.quote_status}</p></div>
            <div><span className="text-muted-foreground">Rep</span><p>{header.rep_name}</p></div>
            <div><span className="text-muted-foreground">Branch</span><p>{header.branch_name}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader><CardTitle className="text-heading-md">Line Items</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {lines.map(line => (
              <div key={line.quote_line_id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="text-body-md font-medium">{line.description || line.sku}</p>
                  <p className="text-xs text-muted-foreground">
                    SKU: {line.sku} · Qty: {parseFloat(line.quantity ?? "1")} · {line.match_status}
                    {line.intent_class === "price-check" && <span className="ml-2 text-warning">⚠ price-check</span>}
                  </p>
                </div>
                <p className="font-semibold tabular">${parseFloat(line.ext_price ?? "0").toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Draft (SCR-03) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-heading-md">
              <Bot size={18} className="text-brand" /> AI Follow-Up Draft
            </CardTitle>
            {!isSuppressed && (
              <Button onClick={generateDraft} disabled={draftLoading} size="sm" variant="outline">
                <RefreshCw size={14} className={draftLoading ? "animate-spin" : ""} />
                {draft ? "Regenerate" : "Generate Draft"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isSuppressed && (
            <p className="text-muted-foreground text-body-sm">This quote is suppressed ({topLine?.suppression_reason}) and excluded from follow-up.</p>
          )}
          {!isSuppressed && !draft && !draftLoading && (
            <p className="text-muted-foreground text-body-sm">Click "Generate Draft" to create an AI-powered follow-up email.</p>
          )}
          {draftLoading && <div className="agent-at-work h-24 rounded-md" />}
          {draft && !draftLoading && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subject</p>
                <p className="text-body-md font-medium border border-border rounded-lg p-3 bg-sunken">{draft.subject}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Body</p>
                <pre className="text-body-sm whitespace-pre-wrap border border-border rounded-lg p-3 bg-sunken font-sans">{draft.body}</pre>
              </div>

              {/* SCR-04: Send via Outlook */}
              <Separator />
              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleSendViaOutlook} disabled={sendIntentFired}>
                  <Send size={16} />
                  {sendIntentFired ? "Opened in Outlook" : "Send via Outlook"}
                </Button>
                {sendIntentFired && <span className="text-xs text-success">✓ Send intent recorded</span>}
              </div>

              {/* SCR-05: Outcome marking */}
              {sendIntentFired && !outcomeSet && (
                <div className="space-y-2">
                  <p className="text-body-sm text-muted-foreground">How did it go?</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant="outline"
                        disabled={outcomeSubmitting}
                        onClick={() => handleOutcome(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {outcomeSet && (
                <div className="flex items-center gap-2 text-success text-body-sm">
                  <CheckCircle size={16} /> Outcome recorded: {OUTCOME_LABELS[outcomeSet] ?? outcomeSet}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
