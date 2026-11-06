import { describe, expect, it } from "vitest";
import { checkPromptPack, promptPackToBundle, promptPackToMarkdown, type PromptPack } from "./product";

const mk = (n: number) => ({
  name: `Prompt ${n}`, useCase: "Plan the week",
  prompt: `You are an expert planner. Using {topic}, write a detailed weekly plan number ${n} with priorities and time blocks.`,
  example: "Monday: deep work 9-11, review inbox 11-11:30, call with client at 14:00.",
});
const pack = (count = 15): PromptPack => ({ title: "Planner prompts", audience: "freelancers", summary: "Fifteen prompts for planning.", prompts: Array.from({ length: count }, (_, i) => mk(i + 1)) });

describe("prompt pack QC", () => {
  it("passes a good pack", () => {
    const r = checkPromptPack(pack());
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
  });
  it("flags too few, duplicates, claims, placeholders, no variable", () => {
    const p = pack(3);
    p.prompts[1] = { ...p.prompts[0]! };
    p.summary = "Guarantee passive income TODO";
    p.prompts[2]!.prompt = "short";
    const codes = checkPromptPack(p).issues.map((i) => i.code);
    for (const c of ["too_few_prompts", "duplicate_name", "duplicate_prompt", "income_claim", "placeholder_text", "prompt_too_short", "no_variable"]) expect(codes).toContain(c);
    expect(checkPromptPack(p).passed).toBe(false);
  });
  it("renders markdown and a bundle", () => {
    const p = pack();
    expect(promptPackToMarkdown(p)).toContain("## 15. Prompt 15");
    const b = promptPackToBundle(p);
    expect(b.files[0]!.bytes).toBeGreaterThan(100);
    expect(b.currency).toBe("USD");
  });
});

import { checkSheetTemplate, sheetTemplateToBundle, tabToCsv, type SheetTemplate } from "./product";
const tab = (name: string) => ({ name, purpose: "Track things", columns: ["Date", "Item", "Amount"], rows: Array.from({ length: 5 }, (_, i) => [`2026-01-0${i + 1}`, `Item, ${i}`, `=SUM(B${i + 1}:C${i + 1})`]) });
const sheet = (): SheetTemplate => ({
  title: "Budget tracker", audience: "freelancers", summary: "A simple monthly budget.",
  instructions: "Duplicate the sheet each month. Fill in the Income tab first, then add expenses as they happen. The Summary tab totals everything automatically, so never overwrite the formulas in the grey cells.",
  tabs: [tab("Income"), tab("Expenses"), tab("Summary")],
});
describe("sheet template QC", () => {
  it("passes a good template and exports CSV with quoting", () => {
    expect(checkSheetTemplate(sheet()).passed).toBe(true);
    expect(tabToCsv(sheet().tabs[0]!)).toContain('"Item, 0"');
    const b = sheetTemplateToBundle(sheet());
    expect(b.files.map((f) => f.name)).toEqual(["README.md", "Income.csv", "Expenses.csv", "Summary.csv"]);
  });
  it("flags ragged rows, bad formulas, duplicates, few tabs, claims", () => {
    const s = sheet();
    s.tabs = [s.tabs[0]!, { ...s.tabs[0]! }];
    s.tabs[0]!.rows[0] = ["a", "b"];
    s.tabs[1]!.rows[1]![2] = "=SUM(A1";
    s.summary = "Guaranteed passive income";
    const codes = checkSheetTemplate(s).issues.map((i) => i.code);
    for (const c of ["too_few_tabs", "duplicate_tab", "ragged_row", "bad_formula", "income_claim"]) expect(codes).toContain(c);
  });
});

import { checkChecklist, checklistToMarkdown, type ChecklistDoc } from "./product";
const cl = (): ChecklistDoc => ({ title: "Launch", audience: "creators", summary: "Before you launch a product.", sections: Array.from({ length: 4 }, (_, s) => ({ heading: `Step ${s}`, items: Array.from({ length: 5 }, (_, i) => ({ text: `Do task ${s}-${i} carefully` })) })) });
describe("checklist QC", () => {
  it("passes a good checklist and renders tick boxes", () => {
    expect(checkChecklist(cl()).passed).toBe(true);
    expect(checklistToMarkdown(cl())).toContain("- [ ] Do task 0-0 carefully");
  });
  it("flags few sections, few items, duplicates, claims", () => {
    const c = cl(); c.sections = c.sections.slice(0, 2); c.sections[0]!.items = c.sections[0]!.items.slice(0, 2);
    c.sections[1]!.items[1] = { ...c.sections[1]!.items[0]! }; c.summary = "Guaranteed passive income";
    const codes = checkChecklist(c).issues.map((i) => i.code);
    for (const k of ["too_few_sections", "too_few_items", "duplicate_item", "income_claim"]) expect(codes).toContain(k);
  });
});
