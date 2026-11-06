import { describe, expect, it } from "vitest";
import { createGuard, createNicheService } from "./nicheAi";
import { buildServer } from "./server";
import { createMemoryRepo } from "./repo";

const idea = (n: number) => ({
  category: "tool", name_en: `Idea ${n} tool`, name_vi: `Ý tưởng ${n}`, why_en: "Sells because X.", why_vi: "Bán được vì X.",
  trend_en: "Search interest rising (Google Trends)", trend_vi: "Lượng tìm kiếm tăng", potential: 150,
});
const reply = (stop_reason: string, text: string) =>
  ({ stop_reason, content: [{ type: "text", text }], usage: { input_tokens: 1000, output_tokens: 500 } });
const fake = (...replies: object[]) => {
  const calls: any[] = [];
  return { calls, client: { messages: { create: async (p: any) => { calls.push(p); const r = replies.shift(); if (r instanceof Error) throw r; return r; } } } as any };
};
const guard = (over = {}) => createGuard({ minIntervalMs: 0, maxCallsPerDay: 5, dailyBudgetUsd: 1, ...over });

describe("AI niche suggestions", () => {
  it("returns Claude ideas, clamps potential and limits the count", async () => {
    const f = fake(reply("end_turn", "Here you go:\n" + JSON.stringify({ ideas: [idea(1), idea(2), idea(3)] })));
    const out = await createNicheService({ client: f.client, guard: guard() }).suggest({ count: 2 });
    expect(out.source).toBe("claude");
    expect(out.ideas).toHaveLength(2);
    expect(out.ideas[0]!.potential).toBe(100);
    expect(out.ideas[0]!.trend?.vi).toBeTruthy();
    expect(f.calls[0].tools[0].type).toBe("web_search_20260209");
    expect(f.calls[0].max_tokens).toBeLessThanOrEqual(4000);
  });

  it("continues after pause_turn", async () => {
    const f = fake(reply("pause_turn", ""), reply("end_turn", JSON.stringify({ ideas: [idea(1)] })));
    const out = await createNicheService({ client: f.client, guard: guard() }).suggest({ count: 1 });
    expect(out.source).toBe("claude");
    expect(f.calls).toHaveLength(2);
  });

  it("falls back to the catalog without a key, on bad output, on API errors and on refusals", async () => {
    expect((await createNicheService({ guard: guard() }).suggest()).note).toBe("no_api_key");
    for (const r of [reply("end_turn", "not json"), reply("refusal", ""), new Error("boom")]) {
      const out = await createNicheService({ client: fake(r).client, guard: guard() }).suggest({ count: 4 });
      expect(out.source).toBe("catalog");
      expect(out.ideas).toHaveLength(4);
    }
  });

  it("enforces interval, daily calls and daily budget", async () => {
    let t = Date.UTC(2026, 10, 6, 12);
    const ok = () => reply("end_turn", JSON.stringify({ ideas: [idea(1)] }));
    const f = fake(ok(), ok(), ok(), ok());
    const svc = createNicheService({ client: f.client, guard: createGuard({ minIntervalMs: 10_000, maxCallsPerDay: 2, dailyBudgetUsd: 1, now: () => t }) });
    expect((await svc.suggest()).source).toBe("claude");
    expect((await svc.suggest()).note).toBe("rate_limited");
    t += 11_000; expect((await svc.suggest()).source).toBe("claude");
    t += 11_000; expect((await svc.suggest()).note).toBe("daily_call_limit");
    t += 86_400_000; expect((await svc.suggest()).source).toBe("claude");
    expect(f.calls).toHaveLength(3);

    const g = createGuard({ minIntervalMs: 0, maxCallsPerDay: 99, dailyBudgetUsd: 0.01 });
    g.check(); g.record(0.02);
    expect((await createNicheService({ client: fake(ok()).client, guard: g }).suggest()).note).toBe("daily_budget_reached");
  });

  it("is served by POST /niches/suggest and validates input", async () => {
    const app = buildServer({ repo: createMemoryRepo() });
    const res = await app.inject({ method: "POST", url: "/niches/suggest", payload: { count: 3 } });
    expect(res.statusCode).toBe(200);
    expect(res.json().source).toBe("catalog");
    expect(res.json().ideas).toHaveLength(3);
    expect((await app.inject({ method: "POST", url: "/niches/suggest", payload: { count: 99 } })).statusCode).toBe(400);
  });
});
