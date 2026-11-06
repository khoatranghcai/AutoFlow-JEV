import type { Decision, Economics, Funnel, MarketSignals, PipelineEvent, QaResult } from "@autoflow/engine";

export interface RunView {
  phase: number | null;
  market?: MarketSignals;
  funnel?: Funnel;
  riskScore?: number;
  economics?: Economics;
  qa: { attempt: number; result: QaResult }[];
  decision?: Decision;
  proposal?: Extract<PipelineEvent, { type: "proposal" }>;
  ended: boolean;
  log: PipelineEvent[];
}

export const emptyRun = (): RunView => ({ phase: null, qa: [], ended: false, log: [] });

/** Fold a pipeline event into the view state the dashboard renders. */
export function applyEvent(s: RunView, e: PipelineEvent): RunView {
  const base = { ...s, log: [...s.log, e] };
  switch (e.type) {
    case "phase": return { ...base, phase: e.phase };
    case "market": return { ...base, market: e.market };
    case "funnel": return { ...base, funnel: e.funnel, riskScore: e.riskScore };
    case "economics": return { ...base, economics: e.economics };
    case "qa": return { ...base, qa: [...s.qa, { attempt: e.attempt, result: e.result }] };
    case "verdict": return { ...base, decision: e.decision };
    case "proposal": return { ...base, proposal: e };
    case "end": return { ...base, ended: true };
  }
}
