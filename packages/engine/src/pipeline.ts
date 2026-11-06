import { RULES, type RiskTolerance } from "@autoflow/config";
import { computeEconomics, type Economics } from "./economics";
import { decide, type Decision } from "./verdict";

export interface RunInput {
  niche: string;
  tolerance: RiskTolerance;
  maxBudget: number;
  /** Force the first sandbox attempt to fail, to exercise the FIX loop. */
  armBug: boolean;
}

export interface MarketSignals {
  searchVolume: number;
  trendVelocityPct: number;
  competition: number; // 0..100
  categoryMarginPct: number;
  redFlag: boolean;
  score: number; // viability
}
export interface Funnel {
  offer: { type: string; price: number; platform: string };
  steps: { stage: "Hook" | "Offer" | "Upsell"; channel: string }[];
}
export interface QaResult { pass: boolean; check?: string; error?: string }

/** The agent seam: `sim` implements it with seeded randomness, `live` will call real services. */
export interface Agents {
  killmyidea(input: RunInput): Promise<MarketSignals>;
  chess(input: RunInput, market: MarketSignals): Promise<Funnel>;
  doom(input: RunInput, market: MarketSignals): Promise<{ riskScore: number }>;
  tax(input: RunInput, market: MarketSignals, funnel: Funnel): Promise<{ cpa: number; tokens: number }>;
  validator(input: RunInput, attempt: number): Promise<QaResult>;
  /** Roll for the 20% stress-test escape; injected so runs are reproducible. */
  escapeRoll(): number;
}

export type PipelineEvent =
  | { type: "phase"; phase: 0 | 1 | 2 | 3 | 4 }
  | { type: "market"; market: MarketSignals }
  | { type: "funnel"; funnel: Funnel; riskScore: number }
  | { type: "economics"; economics: Economics }
  | { type: "qa"; attempt: number; result: QaResult }
  | { type: "verdict"; decision: Decision }
  | { type: "proposal"; niche: string; budget: number; economics: Economics; riskScore: number }
  | { type: "end"; verdict: Decision["verdict"] };

/**
 * Run one idea through the five JEV phases. An async generator so a consumer can
 * pause between phases (step mode) simply by not pulling the next event.
 * SHIP only yields a proposal: launching requires a human approval elsewhere.
 */
export async function* runPipeline(input: RunInput, agents: Agents): AsyncGenerator<PipelineEvent> {
  yield { type: "phase", phase: 0 };
  const market = await agents.killmyidea(input);
  yield { type: "market", market };

  const p = RULES.risk[input.tolerance];
  const escapeRoll = agents.escapeRoll();
  const stressFailed = market.score < p.scoreMin || market.redFlag;
  if (stressFailed && escapeRoll < RULES.killProbability) {
    const decision = decide({ tolerance: input.tolerance, viabilityScore: market.score, redFlag: market.redFlag, riskScore: 0, netMarginPct: 100, qaAttempts: [], escapeRoll });
    yield { type: "verdict", decision };
    yield { type: "end", verdict: decision.verdict };
    return;
  }

  yield { type: "phase", phase: 1 };
  const funnel = await agents.chess(input, market);
  const { riskScore } = await agents.doom(input, market);
  yield { type: "funnel", funnel, riskScore };

  yield { type: "phase", phase: 2 };
  const { cpa, tokens } = await agents.tax(input, market, funnel);
  const economics = computeEconomics({
    competition: market.competition,
    searchVolume: market.searchVolume,
    categoryMarginPct: market.categoryMarginPct,
    price: funnel.offer.price,
    adBudget: input.maxBudget,
    cpa,
    tokens,
  });
  yield { type: "economics", economics };

  // Fail fast before spending sandbox time when the numbers already kill the idea.
  const early = decide({ tolerance: input.tolerance, viabilityScore: market.score, redFlag: market.redFlag, riskScore, netMarginPct: economics.marginPct, qaAttempts: [true], escapeRoll });
  if (early.verdict === "KILL") {
    yield { type: "verdict", decision: early };
    yield { type: "end", verdict: "KILL" };
    return;
  }

  yield { type: "phase", phase: 3 };
  const attempts: boolean[] = [];
  for (let n = 1; n <= RULES.maxFixAttempts; n++) {
    const result = await agents.validator(input, n);
    attempts.push(result.pass);
    yield { type: "qa", attempt: n, result };
    if (result.pass) break;
  }

  yield { type: "phase", phase: 4 };
  const decision = decide({ tolerance: input.tolerance, viabilityScore: market.score, redFlag: market.redFlag, riskScore, netMarginPct: economics.marginPct, qaAttempts: attempts, escapeRoll });
  yield { type: "verdict", decision };
  if (decision.verdict === "SHIP") {
    yield { type: "proposal", niche: input.niche, budget: input.maxBudget, economics, riskScore };
  }
  yield { type: "end", verdict: decision.verdict };
}
