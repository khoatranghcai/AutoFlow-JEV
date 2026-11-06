import { expect, test } from "vitest";
import { createRng } from "./rng";

test("same seed gives the same sequence", () => {
  const a = createRng(42), b = createRng(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
test("values are in [0,1)", () => {
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});
