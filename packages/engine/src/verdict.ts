import { RULES, type RiskTolerance, type Verdict } from "@autoflow/config";

export interface VerdictInput {
  tolerance: RiskTolerance;
  viabilityScore: number;
  redFlag: boolean;
  riskScore: number;
  netMarginPct: number;
  /** Sandbox QA outcomes in order, one entry per attempt (true = passed). */
  qaAttempts: boolean[];
  /** Draw in [0,1) deciding the 20% "escape" for ideas that fail the stress test. */
  escapeRoll: number;
}

export type Reason =
  | { code: "stress"; score: number; min: number; redFlag: boolean }
  | { code: "risk"; risk: number; cap: number }
  | { code: "margin"; margin: number; floor: number }
  | { code: "fix_exhausted"; attempts: number }
  | { code: "ship"; margin: number; risk: number; attempt: number };

export interface Decision {
  verdict: Verdict;
  reason: Reason;
  /** Stress test failed but the idea survived the escape roll. */
  escaped: boolean;
}

/** Resolve a run to KILL, FIX or SHIP. FIX means "retry QA"; it is returned only while attempts remain. */
export function decide(i: VerdictInput): Decision {
  const p = RULES.risk[i.tolerance];
  let escaped = false;

  if (i.viabilityScore < p.scoreMin || i.redFlag) {
    if (i.escapeRoll < RULES.killProbability) {
      return { verdict: "KILL", reason: { code: "stress", score: i.viabilityScore, min: p.scoreMin, redFlag: i.redFlag }, escaped };
    }
    escaped = true;
  }
  if (i.riskScore > p.riskCap) {
    return { verdict: "KILL", reason: { code: "risk", risk: i.riskScore, cap: p.riskCap }, escaped };
  }
  if (i.netMarginPct < p.marginMin) {
    return { verdict: "KILL", reason: { code: "margin", margin: i.netMarginPct, floor: p.marginMin }, escaped };
  }

  const max = RULES.maxFixAttempts;
  const passedAt = i.qaAttempts.findIndex(Boolean);
  if (passedAt >= 0 && passedAt < max) {
    return { verdict: "SHIP", reason: { code: "ship", margin: i.netMarginPct, risk: i.riskScore, attempt: passedAt + 1 }, escaped };
  }
  if (i.qaAttempts.length >= max) {
    return { verdict: "KILL", reason: { code: "fix_exhausted", attempts: max }, escaped };
  }
  return { verdict: "FIX", reason: { code: "fix_exhausted", attempts: i.qaAttempts.length }, escaped };
}
