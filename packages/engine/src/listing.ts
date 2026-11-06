/**
 * Marketplace listing layer. Adapters are the only code allowed to talk to a marketplace.
 * Nothing here does network I/O: the dry-run adapters only build the payload that WOULD be sent,
 * so a human can review it. Real adapters (Gumroad, Lemon Squeezy) come after approval of real keys.
 */
export type MarketplaceId = "gumroad" | "lemonsqueezy";

export interface ProductBundle {
  title: string;
  description: string;
  priceCents: number;
  currency: "USD";
  files: { name: string; bytes: number }[];
  tags: string[];
}

export interface ListingDraft {
  marketplace: MarketplaceId;
  payload: ProductBundle;
  /** Always true for dry-run adapters. A real adapter must never be built without an approved proposal. */
  dryRun: boolean;
}

export interface MarketplaceAdapter {
  id: MarketplaceId;
  /** Builds a listing without sending it. */
  prepare(bundle: ProductBundle): ListingDraft;
}

/** Editable defaults, NOT verified against current marketplace pricing. Confirm before using real money. */
export interface FeeModel { percent: number; flatCents: number }
export const DEFAULT_FEES: Record<MarketplaceId, FeeModel> = {
  gumroad: { percent: 10, flatCents: 50 },
  lemonsqueezy: { percent: 5, flatCents: 50 },
};

export function netPerSaleCents(priceCents: number, fee: FeeModel): number {
  return Math.max(0, priceCents - Math.round((priceCents * fee.percent) / 100) - fee.flatCents);
}

export function createDryRunAdapter(id: MarketplaceId): MarketplaceAdapter {
  return {
    id,
    prepare(bundle) {
      if (bundle.priceCents < 100) throw new Error("price_too_low");
      if (!bundle.files.length) throw new Error("no_files");
      return { marketplace: id, payload: bundle, dryRun: true };
    },
  };
}
