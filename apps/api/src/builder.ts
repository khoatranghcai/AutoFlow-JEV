import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  checkPromptPack, checkSheetTemplate, promptPackToBundle, promptPackToMarkdown, sheetTemplateToBundle, sheetTemplateToMarkdown,
  type ProductBundle, type ProductKind, type PromptPack, type QcReport, type SheetTemplate,
} from "@autoflow/engine";
import { createGuard } from "./nicheAi";

const PRICE_IN = 4, PRICE_OUT = 20; // Opus 5.5 USD per million tokens

const PackSchema = z.object({
  title: z.string().min(3), audience: z.string().min(3), summary: z.string().min(10),
  prompts: z.array(z.object({ name: z.string(), useCase: z.string(), prompt: z.string(), example: z.string() })).min(1),
});
const SheetSchema = z.object({
  title: z.string().min(3), audience: z.string().min(3), summary: z.string().min(10), instructions: z.string().min(10),
  tabs: z.array(z.object({ name: z.string().min(1), purpose: z.string(), columns: z.array(z.string()).min(1), rows: z.array(z.array(z.string())) })).min(1),
});

const RULES = "No income guarantees, no placeholder text, no medical, legal or financial advice claims. English output.";
const PACK_SYSTEM = `You write sellable prompt packs: ready-to-use prompts a buyer pastes into an AI assistant.
Write for the given niche and audience. Make 15 distinct prompts. Each prompt has: name, useCase (one sentence), prompt (at least 3 sentences, with {variables} in curly braces the buyer fills in), example (a realistic sample of the output, not a description).
${RULES}
Final answer: ONLY JSON: {"title","audience","summary","prompts":[{"name","useCase","prompt","example"}]}.`;
const SHEET_SYSTEM = `You design sellable spreadsheet/database templates that import into Google Sheets and Notion as CSV.
Write for the given niche and audience. Make 3 to 5 tabs that work together (for example inputs, tracking, summary). Each tab has: name, purpose (one sentence), columns (3 or more, unique), rows (at least 5 realistic sample rows, every row exactly as long as columns; all cells are strings). Use spreadsheet formulas (starting with "=") only where they are correct and have balanced parentheses. "instructions" is a how-to-use text of at least 3 sentences.
${RULES}
Final answer: ONLY JSON: {"title","audience","summary","instructions","tabs":[{"name","purpose","columns":[...],"rows":[[...]]}]}.`;

export interface Built { kind: ProductKind; content: PromptPack | SheetTemplate; qc: QcReport; bundle: ProductBundle; markdown: string }
export type BuildResult = ({ ok: true; attempts: number } & Built) | { ok: false; reason: string };

const KINDS = {
  prompt_pack: {
    system: PACK_SYSTEM, maxTokens: 16000,
    make(json: unknown): Built {
      const content = PackSchema.parse(json);
      return { kind: "prompt_pack", content, qc: checkPromptPack(content), bundle: promptPackToBundle(content), markdown: promptPackToMarkdown(content) };
    },
  },
  sheet_template: {
    system: SHEET_SYSTEM, maxTokens: 24000,
    make(json: unknown): Built {
      const content = SheetSchema.parse(json);
      return { kind: "sheet_template", content, qc: checkSheetTemplate(content), bundle: sheetTemplateToBundle(content), markdown: sheetTemplateToMarkdown(content) };
    },
  },
} as const;

export interface BuilderOptions {
  client?: Pick<Anthropic, "messages">;
  guard: ReturnType<typeof createGuard>;
  model?: string;
  maxFixAttempts?: number;
}

/** Builds a product with Claude, runs the QC gate and retries with the QC issues (max 3 attempts, like the FIX loop). Never lists anything. */
export function createBuilder({ client, guard, model = "claude-opus-5-5", maxFixAttempts = 3 }: BuilderOptions) {
  async function build(kind: ProductKind, { niche, audience }: { niche: string; audience?: string }): Promise<BuildResult> {
    if (!client) return { ok: false, reason: "no_api_key" };
    const cfg = KINDS[kind];
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Niche: ${niche}.${audience ? ` Audience: ${audience}.` : ""}` }];
    let lastQc: QcReport | undefined;
    for (let attempt = 1; attempt <= maxFixAttempts; attempt++) {
      const blocked = guard.check();
      if (blocked) return { ok: false, reason: blocked };
      try {
        const res = await client.messages.create({ model, max_tokens: cfg.maxTokens, system: cfg.system, messages, output_config: { effort: "low" } });
        guard.record((res.usage.input_tokens * PRICE_IN + res.usage.output_tokens * PRICE_OUT) / 1e6);
        if (res.stop_reason === "refusal") return { ok: false, reason: "refusal" };
        const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
        const built = cfg.make(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
        lastQc = built.qc;
        if (built.qc.passed) return { ok: true, attempts: attempt, ...built };
        messages.push({ role: "assistant", content: text }, { role: "user", content: `Quality check failed: ${built.qc.issues.map((i) => `${i.code} (${i.detail})`).join("; ")}. Return the full corrected JSON.` });
      } catch (e) {
        return { ok: false, reason: e instanceof Anthropic.APIError ? `api_error_${e.status}` : "ai_failed" };
      }
    }
    return { ok: false, reason: `qc_failed:${lastQc?.issues.map((i) => i.code).join(",") ?? ""}` };
  }
  return {
    build,
    buildPromptPack: (input: { niche: string; audience?: string }) => build("prompt_pack", input),
    buildSheetTemplate: (input: { niche: string; audience?: string }) => build("sheet_template", input),
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
