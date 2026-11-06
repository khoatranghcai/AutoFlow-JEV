import { expect, test } from "vitest";
import { agentState } from "./agentStatus";
import { applyEvent, emptyRun } from "./runView";

test("idle before a run; killmyidea active in phase 0", () => {
  expect(agentState("killmyidea", emptyRun())).toBe("idle");
  const v = applyEvent(emptyRun(), { type: "phase", phase: 0 });
  expect(agentState("killmyidea", v)).toBe("active");
  expect(agentState("chess", v)).toBe("idle");
});
test("failed QA attempt flags the validator as error", () => {
  let v = applyEvent(emptyRun(), { type: "phase", phase: 3 });
  v = applyEvent(v, { type: "qa", attempt: 1, result: { pass: false, error: "x" } });
  expect(agentState("validator", v)).toBe("error");
  expect(agentState("killmyidea", v)).toBe("done");
});
test("hitl waits when a proposal is open", () => {
  let v = applyEvent(emptyRun(), { type: "phase", phase: 4 });
  v = applyEvent(v, { type: "proposal", niche: "n", budget: 1, riskScore: 1, economics: { units: 1, revenue: 1, stripeFees: 0, platformFee: 0, tokenCost: 0, hosting: 0, adBudget: 0, net: 1, marginPct: 1 } });
  expect(agentState("hitl", v)).toBe("warn");
});
