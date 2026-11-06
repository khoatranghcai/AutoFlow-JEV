import { describe, expect, it } from "vitest";
import { NICHE_CATEGORIES, NICHE_IDEAS, suggestNiches } from "./niches";

describe("suggestNiches", () => {
  it("is reproducible for a seed and differs across seeds", () => {
    expect(suggestNiches(1).map((i) => i.id)).toEqual(suggestNiches(1).map((i) => i.id));
    expect(suggestNiches(1).map((i) => i.id)).not.toEqual(suggestNiches(2).map((i) => i.id));
  });
  it("covers distinct categories first", () => {
    const picks = suggestNiches(5, 6);
    expect(new Set(picks.map((p) => p.category)).size).toBe(6);
  });
  it("never repeats an idea and honours exclusions", () => {
    const all = suggestNiches(3, 100);
    expect(new Set(all.map((i) => i.id)).size).toBe(NICHE_IDEAS.length);
    expect(suggestNiches(3, 100, [NICHE_IDEAS[0]!.id]).some((i) => i.id === NICHE_IDEAS[0]!.id)).toBe(false);
  });
  it("catalog is complete in both languages with sane scores", () => {
    for (const c of NICHE_CATEGORIES) expect(NICHE_IDEAS.filter((i) => i.category === c).length).toBeGreaterThanOrEqual(3);
    for (const i of NICHE_IDEAS) {
      expect(i.name.en && i.name.vi && i.why.en && i.why.vi).toBeTruthy();
      expect(i.potential).toBeGreaterThanOrEqual(0); expect(i.potential).toBeLessThanOrEqual(100);
    }
  });
});
