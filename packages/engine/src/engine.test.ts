import { describe, expect, test } from "vitest";
import { computeEconomics, decide, InsufficientCapitalError, refund, reserve, settle, total } from "./index";

describe("economics", () => {
  test("reproduces the v20 preset finance block shape", () => {
    const e = computeEconomics({ competition: 30, searchVolume: 20000, categoryMarginPct: 70, price: 49, adBudget: 30, cpa: 9.1, tokens: 412000 });
    expect(e.revenue).toBe(e.units * 49);
    expect(e.tokenCost).toBeCloseTo(3.708, 3);
    expect(e.net).toBeCloseTo(e.revenue - e.stripeFees - e.platformFee - e.tokenCost - e.hosting - 30, 6);
  });
});

const base = { tolerance: "MED" as const, viabilityScore: 70, redFlag: false, riskScore: 4, netMarginPct: 40, qaAttempts: [true], escapeRoll: 0.5 };

describe("decide", () => {
  test("SHIP when everything clears", () => expect(decide(base).verdict).toBe("SHIP"));
  test("weak score is killed 80% of the time", () => {
    expect(decide({ ...base, viabilityScore: 31, escapeRoll: 0.5 }).verdict).toBe("KILL");
    const d = decide({ ...base, viabilityScore: 31, escapeRoll: 0.9 });
    expect(d.escaped).toBe(true);
    expect(d.verdict).toBe("SHIP");
  });
  test("red flag kills even with a good score", () => expect(decide({ ...base, redFlag: true, escapeRoll: 0 }).verdict).toBe("KILL"));
  test("risk over the cap kills", () => expect(decide({ ...base, riskScore: 8 }).reason.code).toBe("risk"));
  test("margin under the floor kills", () => expect(decide({ ...base, netMarginPct: 20 }).reason.code).toBe("margin"));
  test("QA failure asks for FIX while attempts remain", () => {
    expect(decide({ ...base, qaAttempts: [false] }).verdict).toBe("FIX");
    expect(decide({ ...base, qaAttempts: [false, true] })).toMatchObject({ verdict: "SHIP", reason: { attempt: 2 } });
  });
  test("three failed attempts kill", () => expect(decide({ ...base, qaAttempts: [false, false, false] }).reason.code).toBe("fix_exhausted"));
  test("LOW tolerance is stricter than HIGH", () => {
    const x = { ...base, viabilityScore: 50, escapeRoll: 0.5 };
    expect(decide({ ...x, tolerance: "LOW" }).verdict).toBe("KILL");
    expect(decide({ ...x, tolerance: "HIGH" }).verdict).toBe("SHIP");
  });
});

describe("capital", () => {
  const s = { liquid: 1000, pool: 100, reserved: 0 };
  test("reserve draws from the pool first", () => {
    const { state, reservation } = reserve(s, 150);
    expect(reservation).toEqual({ fromPool: 100, fromLiquid: 50 });
    expect(state).toEqual({ liquid: 950, pool: 0, reserved: 150 });
  });
  test("refund returns to the original sources", () => {
    const { state, reservation } = reserve(s, 150);
    expect(refund(state, reservation)).toEqual(s);
  });
  test("refuses more than free capital", () => expect(() => reserve(s, 5000)).toThrow(InsufficientCapitalError));
  test("settle splits profit 80/20 and keeps total consistent", () => {
    const { state, reservation } = reserve(s, 50);
    const after = settle(state, reservation, 100);
    expect(after.reserved).toBe(0);
    expect(after.pool).toBeCloseTo(100 - 50 + 50 + 80, 6);
    expect(total(after)).toBeCloseTo(total(s) + 100, 6);
  });
  test("a loss reduces liquid capital", () => {
    const { state, reservation } = reserve(s, 50);
    expect(total(settle(state, reservation, -20))).toBeCloseTo(total(s) - 20, 6);
  });
});
