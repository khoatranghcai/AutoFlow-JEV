import type { RunView } from "./runView";

export const AGENTS = ["killmyidea", "chess", "doom", "tax", "trader", "builder", "validator", "verdict", "hitl"] as const;
export type AgentId = (typeof AGENTS)[number];
export type AgentState = "idle" | "active" | "done" | "error" | "warn";

/** Phase in which each agent works (0-4). */
const PHASE_OF: Record<AgentId, number> = { killmyidea: 0, chess: 1, doom: 1, tax: 2, trader: 2, builder: 3, validator: 3, verdict: 4, hitl: 4 };

export function agentState(id: AgentId, v: RunView): AgentState {
  if (v.phase === null) return "idle";
  const p = PHASE_OF[id];
  if (id === "hitl") {
    if (v.proposal) return "warn"; // waiting on a human
    return v.ended && v.decision?.verdict === "SHIP" ? "done" : "idle";
  }
  if (id === "validator" || id === "builder") {
    const last = v.qa[v.qa.length - 1];
    if (last && !last.result.pass && !v.ended && v.phase === 3) return id === "validator" ? "error" : "active";
  }
  if (id === "verdict" && v.decision) return v.decision.verdict === "KILL" ? "error" : "done";
  if (v.phase < p) return "idle";
  if (v.phase === p && !v.ended) return "active";
  return "done";
}
