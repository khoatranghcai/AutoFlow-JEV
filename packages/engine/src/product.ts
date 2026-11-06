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

export type ProductKind = "prompt_pack" | "sheet_template";

/** A spreadsheet/database template. Each tab becomes one CSV, which imports into Google Sheets and Notion. */
export interface SheetTemplate {
  title: string;
  audience: string;
  summary: string;
  instructions: string;
  tabs: { name: string; purpose: string; columns: string[]; rows: string[][] }[];
}

const FORMULA_OK = (f: string) => {
  let d = 0;
  for (const c of f) { if (c === "(") d++; if (c === ")" && --d < 0) return false; }
  return d === 0;
};

export function checkSheetTemplate(s: SheetTemplate, opts: { minTabs?: number; minRows?: number } = {}): QcReport {
  const issues: QcIssue[] = [];
  const minTabs = opts.minTabs ?? 3, minRows = opts.minRows ?? 5;
  if (s.tabs.length < minTabs) issues.push({ code: "too_few_tabs", detail: `${s.tabs.length} < ${minTabs}` });
  if (s.instructions.trim().length < 150) issues.push({ code: "instructions_too_short", detail: "how-to-use text is missing or too short" });
  const names = new Set<string>();
  for (const tab of s.tabs) {
    const k = tab.name.trim().toLowerCase();
    if (names.has(k)) issues.push({ code: "duplicate_tab", detail: tab.name });
    names.add(k);
    if (tab.columns.length < 3) issues.push({ code: "too_few_columns", detail: tab.name });
    if (new Set(tab.columns.map((c) => c.trim().toLowerCase())).size !== tab.columns.length) issues.push({ code: "duplicate_column", detail: tab.name });
    if (tab.rows.length < minRows) issues.push({ code: "too_few_rows", detail: `${tab.name}: ${tab.rows.length} < ${minRows}` });
    tab.rows.forEach((r, i) => {
      if (r.length !== tab.columns.length) issues.push({ code: "ragged_row", detail: `${tab.name} row ${i + 1}` });
      r.forEach((cell) => { if (cell.startsWith("=") && !FORMULA_OK(cell)) issues.push({ code: "bad_formula", detail: `${tab.name} row ${i + 1}: ${cell}` }); });
    });
  }
  const all = [s.title, s.summary, s.instructions, ...s.tabs.flatMap((t) => [t.name, t.purpose, ...t.columns, ...t.rows.flat()])].join("\n");
  if (CLAIMS.test(all)) issues.push({ code: "income_claim", detail: "contains income or guarantee claims" });
  if (PLACEHOLDER.test(all)) issues.push({ code: "placeholder_text", detail: "contains placeholder text" });
  return { passed: issues.length === 0, score: Math.max(0, 100 - issues.length * 8), issues };
}

const csvCell = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
export const tabToCsv = (t: SheetTemplate["tabs"][number]) => [t.columns, ...t.rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";

export function sheetTemplateToMarkdown(s: SheetTemplate): string {
  const tabs = s.tabs.map((t, i) => `### ${i + 1}. ${t.name}\n\n${t.purpose}\n\nColumns: ${t.columns.join(", ")}\n`).join("\n");
  return `# ${s.title}\n\n*For: ${s.audience}*\n\n${s.summary}\n\n## How to use\n\n${s.instructions}\n\n## Tabs\n\n${tabs}\n## Import\n\n- Google Sheets: File > Import > Upload each CSV file as a new sheet.\n- Notion: Import > CSV to create each tab as a database.\n`;
}

export function sheetTemplateToBundle(s: SheetTemplate, priceCents = 1900): ProductBundle {
  return {
    title: s.title, description: s.summary, priceCents, currency: "USD",
    files: [{ name: "README.md", bytes: Buffer.byteLength(sheetTemplateToMarkdown(s)) }, ...s.tabs.map((t) => ({ name: `${t.name.replace(/[^\w-]+/g, "_")}.csv`, bytes: Buffer.byteLength(tabToCsv(t)) }))],
    tags: ["template", "notion", "google-sheets"],
  };
}
