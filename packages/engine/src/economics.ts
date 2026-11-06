import { RULES } from "@autoflow/config";

export interface EconomicsInput {
  competition: number; // 0..100
  searchVolume: number; // per month
  categoryMarginPct: number; // median margin of the vertical
  price: number; // USD
  adBudget: number; // USD
  cpa: number; // cost per acquisition, USD (random draw in simulation)
  tokens: number; // API tokens used by the build
}

export interface Economics {
  units: number;
  revenue: number;
  stripeFees: number;
  platformFee: number;
  tokenCost: number;
  hosting: number;
  adBudget: number;
  net: number;
  marginPct: number;
}

/** Projected economics of the 14-day test window (same formula as the v20 dashboard). */
export function computeEconomics(i: EconomicsInput): Economics {
  const units = Math.max(1, Math.round((i.adBudget / i.cpa) * (1 + i.searchVolume / 60000)));
  const revenue = units * i.price;
  const stripeFees = revenue * RULES.fees.stripePct + RULES.fees.stripeFixedUsd * units;
  const platformFee = revenue * RULES.fees.marketplacePct;
  const tokenCost = (i.tokens / 1e6) * RULES.tokenUsdPerMillion;
  const hosting = revenue * (1 - i.categoryMarginPct / 100) * RULES.hostingShareOfCosts;
  const net = revenue - stripeFees - platformFee - tokenCost - hosting - i.adBudget;
  const marginPct = revenue > 0 ? (net / revenue) * 100 : -100;
  return { units, revenue, stripeFees, platformFee, tokenCost, hosting, adBudget: i.adBudget, net, marginPct };
}
