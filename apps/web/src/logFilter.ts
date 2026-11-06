import type { PipelineEvent } from "@autoflow/engine";

export type LogLevel = "info" | "success" | "warn" | "error";

export function levelOf(e: PipelineEvent): LogLevel {
  switch (e.type) {
    case "verdict": return e.decision.verdict === "KILL" ? "error" : e.decision.verdict === "FIX" ? "warn" : "success";
    case "qa": return e.result.pass ? "success" : "warn";
    case "proposal": return "success";
    case "end": return e.verdict === "KILL" ? "error" : "info";
    default: return "info";
  }
}

export interface LogFilter { text: string; level: LogLevel | "all" }

/** Case-insensitive match on the event type or any value in its JSON payload. */
export function filterLog(log: PipelineEvent[], f: LogFilter): PipelineEvent[] {
  const q = f.text.trim().toLowerCase();
  return log.filter((e) => (f.level === "all" || levelOf(e) === f.level) && (!q || JSON.stringify(e).toLowerCase().includes(q)));
}
