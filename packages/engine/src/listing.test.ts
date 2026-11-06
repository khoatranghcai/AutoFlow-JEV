import { describe, expect, it } from "vitest";
import { DEFAULT_FEES, createDryRunAdapter, netPerSaleCents, type ProductBundle } from "./listing";

const bundle: ProductBundle = { title: "T", description: "d", priceCents: 1900, currency: "USD", files: [{ name: "a.pdf", bytes: 10 }], tags: [] };

describe("listing", () => {
  it("computes net per sale", () => {
    expect(netPerSaleCents(1900, DEFAULT_FEES.gumroad)).toBe(1900 - 190 - 50);
    expect(netPerSaleCents(100, { percent: 50, flatCents: 100 })).toBe(0);
  });
  it("dry-run adapter never sends and validates", () => {
    const a = createDryRunAdapter("lemonsqueezy");
    expect(a.prepare(bundle).dryRun).toBe(true);
    expect(() => a.prepare({ ...bundle, files: [] })).toThrow("no_files");
    expect(() => a.prepare({ ...bundle, priceCents: 50 })).toThrow("price_too_low");
  });
});
