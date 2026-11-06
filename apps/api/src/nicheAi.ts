import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { NICHE_CATEGORIES, suggestNiches, type NicheIdea } from "@autoflow/engine";

/** Cost and rate guard for AI niche suggestions. All limits are per API process. */
export interface GuardOptions {
  minIntervalMs: number;
  maxCallsPerDay: number;
  dailyBudgetUsd: number;
  now?: () => number;
}

export function createGuard({ minIntervalMs, maxCallsPerDay, dailyBudgetUsd, now = Date.now }: GuardOptions) {
  let last = 0, day = "", calls = 0, spent = 0;
  const today = () => new Date(now()).toISOString().slice(0, 10);
  const roll = () => { if (day !== today()) { day = today(); calls = 0; spent = 0; } };
  return {
    /** Returns a reason when the call must not happen, otherwise null and reserves the slot. */
    check(): string | null {
      roll();
      if (now() - last < minIntervalMs) return "rate_limited";
      if (calls >= maxCallsPerDay) return "daily_call_limit";
      if (spent >= dailyBudgetUsd) return "daily_budget_reached";
      last = now(); calls += 1;
      return null;
    },
    record(usd: number) { roll(); spent += usd; },
    stats: () => ({ calls, spentUsd: Number(spent.toFixed(4)) }),
  };
}

const Idea = z.object({
  category: z.enum(NICHE_CATEGORIES),
  name_en: z.string().min(3).max(160), name_vi: z.string().min(3).max(200),
  why_en: z.string().min(3).max(300), why_vi: z.string().min(3).max(360),
  trend_en: z.string().min(3).max(300), trend_vi: z.string().min(3).max(360),
  potential: z.number(),
});
const Reply = z.object({ ideas: z.array(Idea).min(1) });

export type SuggestResult = { source: "claude" | "catalog"; ideas: NicheIdea[]; note?: string };

/** Opus 5.5 list prices, USD per million tokens. Web search fees are not included in this estimate. */
const PRICE_IN = 4, PRICE_OUT = 20;

const SYSTEM = `You propose product niches for a small operator who sells digital products, templates, small tools, content and services with low upfront cost.
Use web search to ground every idea in a current, real trend or demand signal (search interest, platform changes, new regulations, seasonal demand, community discussions), then answer.
Rules: ideas must differ from each other in category and audience; be specific (who it is for and what exactly is sold); no illegal, deceptive or adult ideas; no income guarantees.
Final answer: ONLY a JSON object, no prose, no code fences: {"ideas":[{"category":one of ${NICHE_CATEGORIES.join("|")},"name_en","name_vi","why_en","why_vi","trend_en","trend_vi","potential"}]}.
"why" is one short sentence on why it can sell. "trend" names the specific trend or signal and where you saw it. "potential" is an integer 0-100, an honest rough estimate. Vietnamese fields are natural Vietnamese, not literal translation.`;

export interface NicheServiceOptions {
  /** Undefined means no API key: always use the static catalog. */
  client?: Pick<Anthropic, "messages">;
  guard: ReturnType<typeof createGuard>;
  model?: string;
  maxTokens?: number;
  maxSearches?: number;
}

export function createNicheService({ client, guard, model = "claude-opus-5-5", maxTokens = 4000, maxSearches = 3 }: NicheServiceOptions) {
  const catalog = (seed: number, count: number, exclude: string[], note?: string): SuggestResult =>
    ({ source: "catalog", ideas: suggestNiches(seed, count, exclude), ...(note ? { note } : {}) });

  return {
    stats: guard.stats,
    async suggest({ count = 6, exclude = [], seed = Date.now() % 2 ** 31 }: { count?: number; exclude?: string[]; seed?: number } = {}): Promise<SuggestResult> {
      if (!client) return catalog(seed, count, exclude, "no_api_key");
      const blocked = guard.check();
      if (blocked) return catalog(seed, count, exclude, blocked);
      try {
        const messages: Anthropic.MessageParam[] = [{
          role: "user",
          content: `Today is ${new Date().toISOString().slice(0, 10)}. Give ${count} niche ideas.${exclude.length ? ` Do not repeat these: ${exclude.slice(0, 20).join("; ")}.` : ""}`,
        }];
        let text = "";
        for (let turn = 0; turn < 3; turn++) {
          const res = await client.messages.create({
            model, max_tokens: maxTokens, system: SYSTEM, messages,
            output_config: { effort: "low" },
            tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxSearches } as unknown as Anthropic.ToolUnion],
          });
          guard.record((res.usage.input_tokens * PRICE_IN + res.usage.output_tokens * PRICE_OUT) / 1e6);
          if (res.stop_reason === "refusal") throw new Error("refusal");
          if (res.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: res.content }); continue; }
          text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
          break;
        }
        const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
        const parsed = Reply.parse(JSON.parse(json));
        const ideas: NicheIdea[] = parsed.ideas.slice(0, count).map((i, n) => ({
          id: `ai-${Date.now().toString(36)}-${n}`,
          category: i.category,
          potential: Math.max(0, Math.min(100, Math.round(i.potential))),
          name: { en: i.name_en, vi: i.name_vi },
          why: { en: i.why_en, vi: i.why_vi },
          trend: { en: i.trend_en, vi: i.trend_vi },
        }));
        return { source: "claude", ideas };
      } catch (e) {
        return catalog(seed, count, exclude, e instanceof Anthropic.APIError ? `api_error_${e.status}` : "ai_failed");
      }
    },
  };
}

export type NicheService = ReturnType<typeof createNicheService>;

/** Reads ANTHROPIC_API_KEY (and optional limits) from the environment. Without a key the service serves the static catalog. */
export function createNicheServiceFromEnv(env = process.env): NicheService {
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  return createNicheService({
    client: env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 90_000 }) : undefined,
    model: env.NICHE_MODEL || "claude-opus-5-5",
    guard: createGuard({
      minIntervalMs: num(env.NICHE_MIN_INTERVAL_SEC, 20) * 1000,
      maxCallsPerDay: num(env.NICHE_MAX_CALLS_PER_DAY, 20),
      dailyBudgetUsd: num(env.NICHE_DAILY_BUDGET_USD, 2),
    }),
  });
}
