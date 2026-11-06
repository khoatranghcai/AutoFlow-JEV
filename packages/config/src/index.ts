export const VERDICTS = ["KILL", "FIX", "SHIP"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type RiskTolerance = "LOW" | "MED" | "HIGH";

export interface RiskProfile {
  scoreMin: number;
  riskCap: number;
  marginMin: number;
}

/** Business rules. Values mirror the v20 simulation; to be confirmed with the owner. */
export const RULES = {
  killProbability: 0.8,
  maxFixAttempts: 3,
  testWindowDays: 14,
  reinvestShare: 0.8,
  fees: { stripePct: 0.029, stripeFixedUsd: 0.3, marketplacePct: 0.1 },
  tokenUsdPerMillion: 9,
  hostingShareOfCosts: 0.25,
  risk: {
    LOW: { scoreMin: 62, riskCap: 5, marginMin: 35 },
    MED: { scoreMin: 55, riskCap: 7, marginMin: 25 },
    HIGH: { scoreMin: 48, riskCap: 9, marginMin: 15 },
  } satisfies Record<RiskTolerance, RiskProfile>,
} as const;
