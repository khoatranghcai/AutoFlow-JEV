import { createRng } from "./rng";
import { NICHE_CATEGORIES, NICHE_IDEAS, type NicheIdea } from "./nicheCatalog";

export { NICHE_CATEGORIES, NICHE_IDEAS, type NicheCategory, type NicheIdea } from "./nicheCatalog";

/** Pick `count` ideas that differ in category: seeded shuffle of categories and of ideas inside each, then one idea per category in rotation. Same seed, same list. */
export function suggestNiches(seed: number, count = 6, exclude: readonly string[] = []): NicheIdea[] {
  const rng = createRng(seed);
  const shuffle = <T>(xs: readonly T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
    return a;
  };
  const pools = shuffle(NICHE_CATEGORIES).map((c) => shuffle(NICHE_IDEAS.filter((i) => i.category === c && !exclude.includes(i.id))));
  const out: NicheIdea[] = [];
  while (out.length < count && pools.some((p) => p.length)) {
    for (const pool of pools) {
      const next = pool.shift();
      if (next && out.length < count) out.push(next);
    }
  }
  return out;
}
