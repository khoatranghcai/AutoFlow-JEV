import { describe, expect, it } from "vitest";
import { buildServer } from "./server";
import { createMemoryRepo } from "./repo";
import { checkPromptPack, promptPackToBundle, promptPackToMarkdown, type PromptPack } from "@autoflow/engine";
import type { Builder } from "./builder";

const pack: PromptPack = {
  title: "Planner prompts", audience: "freelancers", summary: "Fifteen prompts for planning.",
  prompts: Array.from({ length: 15 }, (_, i) => ({
    name: `P${i}`, useCase: "Plan", prompt: `You are an expert. Using {topic}, produce a detailed plan number ${i} with steps and time blocks.`,
    example: "Monday: deep work 9-11, review inbox 11-11:30, call with client at 14:00.",
  })),
};
const builder = { build: async () => ({ ok: true, kind: "prompt_pack", content: pack, qc: checkPromptPack(pack), bundle: promptPackToBundle(pack), markdown: promptPackToMarkdown(pack), attempts: 1 }) } as unknown as Builder;
const app = () => buildServer({ repo: createMemoryRepo(), builder });

describe("product review queue", () => {
  it("queues a built product as pending, then approves it exactly once without touching capital", async () => {
    const a = app();
    const before = (await a.inject("/capital")).json();
    const built = await a.inject({ method: "POST", url: "/products/prompt-pack", payload: { niche: "planner prompts" } });
    expect(built.statusCode).toBe(201);
    const id = built.json().product.id;
    expect((await a.inject("/products")).json()[0]).toMatchObject({ id, status: "pending" });
    expect((await a.inject(`/products/${id}`)).json().markdown).toContain("# Planner prompts");

    const ok = await a.inject({ method: "POST", url: `/products/${id}/approve`, payload: { decidedBy: "khoa" } });
    expect(ok.json()).toMatchObject({ status: "approved", decidedBy: "khoa" });
    const again = await a.inject({ method: "POST", url: `/products/${id}/reject`, payload: { decidedBy: "khoa" } });
    expect(again.statusCode).toBe(409);
    expect((await a.inject("/capital")).json()).toEqual(before);
  });
  it("404 for unknown, 400 without decidedBy, no queue entry when the build fails", async () => {
    const a = buildServer({ repo: createMemoryRepo() });
    expect((await a.inject({ method: "POST", url: "/products/prompt-pack", payload: { niche: "planner prompts" } })).statusCode).toBe(503);
    expect((await a.inject("/products")).json()).toEqual([]);
    expect((await a.inject("/products/nope")).statusCode).toBe(404);
    expect((await a.inject({ method: "POST", url: "/products/x/approve", payload: {} })).statusCode).toBe(400);
  });
});
