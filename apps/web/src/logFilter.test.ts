import { expect, test } from "vitest";
import type { PipelineEvent } from "@autoflow/engine";
import { filterLog, levelOf } from "./logFilter";

const log: PipelineEvent[] = [
  { type: "phase", phase: 0 },
  { type: "qa", attempt: 1, result: { pass: false, error: "Syntax Error" } },
  { type: "qa", attempt: 2, result: { pass: true } },
  { type: "end", verdict: "KILL" },
];

test("levels", () => {
  expect(levelOf(log[0]!)).toBe("info");
  expect(levelOf(log[1]!)).toBe("warn");
  expect(levelOf(log[2]!)).toBe("success");
  expect(levelOf(log[3]!)).toBe("error");
});
test("text filter is case-insensitive across the payload", () => {
  expect(filterLog(log, { text: "syntax", level: "all" })).toHaveLength(1);
});
test("level filter and empty filter", () => {
  expect(filterLog(log, { text: "", level: "all" })).toHaveLength(4);
  expect(filterLog(log, { text: "", level: "warn" })).toHaveLength(1);
});
