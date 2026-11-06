import { describe, expect, it } from "vitest";
import { createBuilder } from "./builder";
import { createGuard } from "./nicheAi";

const prompt = (n: number) => ({
  name: `P${n}`, useCase: "Plan", prompt: `You are an expert. Using {topic}, produce a detailed plan number ${n} with steps and time blocks.`,
  example: "Monday: deep work 9-11, review inbox 11-11:30, call with client at 14:00.",
});
const good = JSON.stringify({ title: "Pack", audience: "freelancers", summary: "Fifteen planning prompts.", prompts: Array.from({ length: 15 }, (_, i) => prompt(i + 1)) });
const bad = JSON.stringify({ title: "Pack", audience: "freelancers", summary: "Guaranteed passive income.", prompts: [prompt(1)] });
const reply = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }], usage: { input_tokens: 100, output_tokens: 100 } });
const fake = (...r: object[]) => { const calls: any[] = []; return { calls, client: { messages: { create: async (p: any) => { calls.push(p); return r.shift(); } } } as any }; };
const guard = () => createGuard({ minIntervalMs: 0, maxCallsPerDay: 10, dailyBudgetUsd: 5 });

describe("builder", () => {
  it("builds and passes QC", async () => {
    const f = fake(reply(good));
    const out = await createBuilder({ client: f.client, guard: guard() }).buildPromptPack({ niche: "planner" });
    expect(out.ok && out.attempts).toBe(1);
    expect(out.ok && out.bundle.files[0]!.name).toBe("prompt-pack.md");
  });
  it("retries with QC issues then succeeds", async () => {
    const f = fake(reply(bad), reply(good));
    const out = await createBuilder({ client: f.client, guard: guard() }).buildPromptPack({ niche: "planner" });
    expect(out.ok && out.attempts).toBe(2);
    expect(JSON.stringify(f.calls[1].messages)).toContain("income_claim");
  });
  it("gives up after max attempts and without a key", async () => {
    const out = await createBuilder({ client: fake(reply(bad), reply(bad), reply(bad)).client, guard: guard() }).buildPromptPack({ niche: "x" });
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.reason).toContain("qc_failed");
    expect(await createBuilder({ guard: guard() }).buildPromptPack({ niche: "x" })).toEqual({ ok: false, reason: "no_api_key" });
  });
});
