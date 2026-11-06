import type { PipelineEvent } from "@autoflow/engine";

type Proposal = Extract<PipelineEvent, { type: "proposal" }>;

export interface AuditEntry { at: string; niche: string; action: "APPROVED" | "REJECTED"; net: number }

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Plain-text body of the Telegram approval message for a SHIP proposal. */
export function proposalMessage(p: Proposal): string {
  const e = p.economics;
  return [
    `Niche: ${p.niche}`,
    `Budget ${usd(p.budget)} · Margin ${e.marginPct.toFixed(1)}% · Risk ${p.riskScore}/10`,
    `Projected 14-day net ${usd(e.net)} (${e.units} units, revenue ${usd(e.revenue)})`,
  ].join("\n");
}

export const auditEntry = (p: Proposal, action: AuditEntry["action"], now = new Date()): AuditEntry =>
  ({ at: now.toISOString(), niche: p.niche, action, net: p.economics.net });
