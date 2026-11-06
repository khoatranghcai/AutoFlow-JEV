import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { checkPromptPack, promptPackToBundle, promptPackToMarkdown, type PromptPack, type ProductBundle, type QcReport } from "@autoflow/engine";
import { createGuard } from "./nicheAi";

const PRICE_IN = 4, PRICE_OUT = 20; // Opus 5.5 USD per million tokens

const Pack = z.object({
  title: z.string().min(3), audience: z.string().min(3), summary: z.string().min(10),
  prompts: z.array(z.object({ name: z.string(), useCase: z.string(), prompt: z.string(), example: z.string() })).min(1),
});

const SYSTEM = `You write sellable prompt packs: ready-to-use prompts a buyer pastes into an AI assistant.
Write for the given niche and audience. Make 15 distinct prompts. Each prompt has: name, useCase (one sentence), prompt (at least 3 sentences, with {variables} in curly braces the buyer fills in), example (a realistic sample of the output, not a description).
No income guarantees, no placeholder text, no medical, legal or financial advice claims. English output.
Final answer: ONLY JSON: {"title","audience","summary","prompts":[{"name","useCase","prompt","example"}]}.`;

export type BuildResult =
  | { ok: true; pack: PromptPack; qc: QcReport; bundle: ProductBundle; markdown: string; attempts: number }
  | { ok: false; reason: string };

export interface BuilderOptions {
  client?: Pick<Anthropic, "messages">;
  guard: ReturnType<typeof createGuard>;
  model?: string;
  maxFixAttempts?: number;
}

/** Builds a prompt pack with Claude, runs the QC gate and retries with the QC issues (max 3 attempts, like the FIX loop). Never lists anything. */
export function createBuilder({ client, guard, model = "claude-opus-5-5", maxFixAttempts = 3 }: BuilderOptions) {
  return {
    async buildPromptPack({ niche, audience }: { niche: string; audience?: string }): Promise<BuildResult> {
      if (!client) return { ok: false, reason: "no_api_key" };
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Niche: ${niche}.${audience ? ` Audience: ${audience}.` : ""}` }];
      let last: { pack: PromptPack; qc: QcReport } | undefined;
      for (let attempt = 1; attempt <= maxFixAttempts; attempt++) {
        const blocked = guard.check();
        if (blocked) return { ok: false, reason: blocked };
        try {
          const res = await client.messages.create({ model, max_tokens: 16000, system: SYSTEM, messages, output_config: { effort: "low" } });
          guard.record((res.usage.input_tokens * PRICE_IN + res.usage.output_tokens * PRICE_OUT) / 1e6);
          if (res.stop_reason === "refusal") return { ok: false, reason: "refusal" };
          const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
          const pack = Pack.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
          const qc = checkPromptPack(pack);
          last = { pack, qc };
          if (qc.passed) return { ok: true, pack, qc, bundle: promptPackToBundle(pack), markdown: promptPackToMarkdown(pack), attempts: attempt };
          messages.push({ role: "assistant", content: text }, { role: "user", content: `Quality check failed: ${qc.issues.map((i) => `${i.code} (${i.detail})`).join("; ")}. Return the full corrected JSON.` });
        } catch (e) {
          return { ok: false, reason: e instanceof Anthropic.APIError ? `api_error_${e.status}` : "ai_failed" };
        }
      }
      return { ok: false, reason: `qc_failed:${last?.qc.issues.map((i) => i.code).join(",") ?? ""}` };
    },
  };
}
export type Builder = ReturnType<typeof createBuilder>;

export function createBuilderFromEnv(env = process.env): Builder {
  return createBuilder({
    client: env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 180_000 }) : undefined,
    model: env.BUILDER_MODEL || "claude-opus-5-5",
    guard: createGuard({ minIntervalMs: 30_000, maxCallsPerDay: Number(env.BUILDER_MAX_CALLS_PER_DAY) || 12, dailyBudgetUsd: Number(env.BUILDER_DAILY_BUDGET_USD) || 3 }),
  });
}
