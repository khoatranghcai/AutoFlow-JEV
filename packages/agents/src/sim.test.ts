import { describe, expect, test } from "vitest";
import { runPipeline, type PipelineEvent, type RunInput } from "@autoflow/engine";
import { createSimAgents } from "./sim";

const input: RunInput = { niche: "Notion Personal Finance Template with AI", tolerance: "MED", maxBudget: 30, armBug: false };

async function collect(i: RunInput, seed: number, market?: Parameters<typeof createSimAgents>[0]["market"]) {
  const out: PipelineEvent[] = [];
  for await (const e of runPipeline(i, createSimAgents({ seed, market }))) out.push(e);
  return out;
}
const last = (ev: PipelineEvent[]) => ev[ev.length - 1];

describe("pipeline", () => {
  test("same seed gives identical events", async () => {
    expect(await collect(input, 7)).toEqual(await collect(input, 7));
  });
  test("always ends with an end event", async () => {
    for (let seed = 1; seed <= 50; seed++) expect(last(await collect(input, seed))?.type).toBe("end");
  });
  test("a compliance red flag with a weak score is killed in phase 0", async () => {
    // escapeRoll comes from the seeded rng; pick a seed whose roll is < 0.8.
    let killed = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const ev = await collect(input, seed, { score: 31, competition: 94, redFlag: true });
      if (ev.map((e) => e.type).join() === "phase,market,verdict,end") killed++;
    }
    expect(killed).toBeGreaterThan(15); // ~80% expected
    expect(killed).toBeLessThan(30); // some escape
  });
  test("armed bug forces a FIX retry, then ships on attempt 2", async () => {
    const strong = { score: 95, competition: 15, redFlag: false, categoryMarginPct: 85, searchVolume: 50000 };
    let shipped = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const ev = await collect({ ...input, armBug: true, tolerance: "HIGH" }, seed, strong);
      const qa = ev.filter((e) => e.type === "qa");
      if (last(ev) && (last(ev) as { verdict?: string }).verdict === "SHIP") {
        shipped++;
        expect(qa).toHaveLength(2);
        expect(qa[0]).toMatchObject({ attempt: 1, result: { pass: false } });
        expect(ev.some((e) => e.type === "proposal")).toBe(true);
      } else {
        expect(qa).toHaveLength(0); // economics killed it before the sandbox
      }
    }
    expect(shipped).toBeGreaterThan(0);
  });
});
