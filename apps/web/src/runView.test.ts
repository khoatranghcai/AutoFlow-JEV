import { expect, test } from "vitest";
import { createSimAgents } from "@autoflow/agents";
import { runPipeline } from "@autoflow/engine";
import { applyEvent, emptyRun } from "./runView";

test("folding a full run yields a consistent view", async () => {
  let v = emptyRun();
  const input = { niche: "x", tolerance: "HIGH" as const, maxBudget: 30, armBug: true };
  const agents = createSimAgents({ seed: 2, market: { score: 95, competition: 15, categoryMarginPct: 85, redFlag: false, searchVolume: 50000 } });
  for await (const e of runPipeline(input, agents)) v = applyEvent(v, e);
  expect(v.ended).toBe(true);
  expect(v.decision).toBeDefined();
  expect(v.log.at(-1)?.type).toBe("end");
  if (v.decision?.verdict === "SHIP") expect(v.proposal?.niche).toBe("x");
});
