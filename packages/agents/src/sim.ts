import { createRng, type Agents, type MarketSignals } from "@autoflow/engine";

export interface SimOptions {
  seed: number;
  /** Fixed market overrides, e.g. to reproduce the "crypto" preset deterministically. */
  market?: Partial<MarketSignals>;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Seeded simulation of every agent. The viability score formula is a placeholder
 * (the v20 artifact did not expose one); to be tuned against real data.
 */
export function createSimAgents(opts: SimOptions): Agents {
  const rng = createRng(opts.seed);
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);

  return {
    async killmyidea() {
      const searchVolume = Math.round(between(2000, 60000));
      const trendVelocityPct = Math.round(between(-10, 60));
      const competition = Math.round(between(15, 95));
      const categoryMarginPct = Math.round(between(40, 85));
      const score = Math.round(clamp(30 + trendVelocityPct * 0.3 + categoryMarginPct * 0.4 - competition * 0.35 + between(0, 30), 0, 100));
      return { searchVolume, trendVelocityPct, competition, categoryMarginPct, redFlag: false, score, ...opts.market };
    },
    async chess() {
      return {
        offer: { type: "Micro-App / Code", price: 49, platform: "Lemon Squeezy" },
        steps: [
          { stage: "Hook", channel: "Pinterest idea pins" },
          { stage: "Offer", channel: "Micro-App / Code @ $49" },
          { stage: "Upsell", channel: "Pro bundle + lifetime updates" },
        ],
      };
    },
    async doom(_input, market) {
      const riskScore = clamp(Math.round(market.competition / 14 + (market.redFlag ? 3 : 0) + between(-1, 1.5)), 1, 10);
      return { riskScore };
    },
    async tax() {
      return { cpa: 3 + between(0, 4), tokens: Math.round(between(220000, 640000)) };
    },
    async validator(input, attempt) {
      if (input.armBug && attempt === 1) {
        return { pass: false, check: "lint/build", error: "JS Syntax Error: Unexpected token '}'" };
      }
      return { pass: true };
    },
    escapeRoll: () => rng(),
  };
}
