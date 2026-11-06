export type RiskTolerance = "LOW" | "MED" | "HIGH";

/** Business rules. Values mirror the v20 simulation; to be confirmed with the owner. */
export const RULES = {
  viabilityScoreMin: 55,
  killProbability: 0.8,
  maxFixAttempts: 3,
  testWindowDays: 14,
  reinvestShare: 0.8,
  fees: { stripePct: 0.029, stripeFixedUsd: 0.3, marketplacePct: 0.1 },
  tokenUsdPerMillion: 9,
} as const;

export const VERDICTS = ["KILL", "FIX", "SHIP"] as const;
export type Verdict = (typeof VERDICTS)[number];
