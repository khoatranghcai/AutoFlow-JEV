import { expect, test } from "vitest";
import { auditEntry, proposalMessage } from "./telegram";

const p = { type: "proposal" as const, niche: "Notion template", budget: 30, riskScore: 3, economics: { units: 7, revenue: 343, stripeFees: 12, platformFee: 34, tokenCost: 3.7, hosting: 15, adBudget: 30, net: 247.5, marginPct: 72.2 } };

test("message carries niche, budget, margin, risk and projected net", () => {
  const m = proposalMessage(p);
  expect(m).toContain("Notion template");
  expect(m).toContain("$30.00");
  expect(m).toContain("72.2%");
  expect(m).toContain("Risk 3/10");
  expect(m).toContain("$247.50");
});
test("audit entry records what and when", () => {
  expect(auditEntry(p, "APPROVED", new Date("2026-11-06T00:00:00Z"))).toEqual({ at: "2026-11-06T00:00:00.000Z", niche: "Notion template", action: "APPROVED", net: 247.5 });
});
