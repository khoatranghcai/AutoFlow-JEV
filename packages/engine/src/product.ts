import type { ProductBundle } from "./listing";

/** A sellable prompt pack: a set of ready-to-use prompts for one audience. */
export interface PromptPack {
  title: string;
  audience: string;
  summary: string;
  prompts: { name: string; useCase: string; prompt: string; example: string }[];
}

export interface QcIssue { code: string; detail: string }
export interface QcReport { passed: boolean; score: number; issues: QcIssue[] }

const CLAIMS = /(guarantee[sd]?|passive income|get rich|make \$?\d+|risk[- ]free|đảm bảo (thu nhập|kiếm)|kiếm tiền chắc chắn)/i;
const PLACEHOLDER = /(lorem ipsum|TODO|TBD|\[insert[^\]]*\]|xxx)/i;

/** Deterministic quality gate. Cheap checks only: a human still approves before anything is listed. */
export function checkPromptPack(p: PromptPack, opts: { minPrompts?: number } = {}): QcReport {
  const issues: QcIssue[] = [];
  const min = opts.minPrompts ?? 15;
  if (p.prompts.length < min) issues.push({ code: "too_few_prompts", detail: `${p.prompts.length} < ${min}` });
  const names = new Set<string>(), bodies = new Set<string>();
  p.prompts.forEach((x, i) => {
    const k = x.name.trim().toLowerCase();
    if (names.has(k)) issues.push({ code: "duplicate_name", detail: `#${i + 1} ${x.name}` });
    names.add(k);
    const b = x.prompt.replace(/\s+/g, " ").trim().toLowerCase();
    if (bodies.has(b)) issues.push({ code: "duplicate_prompt", detail: `#${i + 1}` });
    bodies.add(b);
    if (x.prompt.trim().length < 80) issues.push({ code: "prompt_too_short", detail: `#${i + 1} ${x.name}` });
    if (x.example.trim().length < 40) issues.push({ code: "example_too_short", detail: `#${i + 1} ${x.name}` });
    if (!/\{[a-z_ ]+\}|\[[A-Za-z_ ]+\]/.test(x.prompt)) issues.push({ code: "no_variable", detail: `#${i + 1} ${x.name}` });
  });
  const all = [p.title, p.summary, ...p.prompts.flatMap((x) => [x.name, x.useCase, x.prompt, x.example])].join("\n");
  if (CLAIMS.test(all)) issues.push({ code: "income_claim", detail: "contains income or guarantee claims" });
  if (PLACEHOLDER.test(all)) issues.push({ code: "placeholder_text", detail: "contains placeholder text" });
  const score = Math.max(0, 100 - issues.length * 8);
  return { passed: issues.length === 0, score, issues };
}

export function promptPackToMarkdown(p: PromptPack): string {
  const body = p.prompts.map((x, i) => `## ${i + 1}. ${x.name}\n\n**Use when:** ${x.useCase}\n\n\`\`\`\n${x.prompt}\n\`\`\`\n\n**Example output:**\n\n${x.example}\n`).join("\n");
  return `# ${p.title}\n\n*For: ${p.audience}*\n\n${p.summary}\n\n${body}`;
}

export function promptPackToBundle(p: PromptPack, priceCents = 1500): ProductBundle {
  const md = promptPackToMarkdown(p);
  return {
    title: p.title, description: p.summary, priceCents, currency: "USD",
    files: [{ name: "prompt-pack.md", bytes: Buffer.byteLength(md) }],
    tags: ["prompts", "ai"],
  };
}
