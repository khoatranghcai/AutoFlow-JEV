import { useRef, useState } from "react";
import { createSimAgents } from "@autoflow/agents";
import type { RiskTolerance } from "@autoflow/config";
import { InsufficientCapitalError, refund, reserve, runPipeline, settle, type CapitalState, type PipelineEvent, type Reservation } from "@autoflow/engine";
import { t, type Key, type Locale } from "@autoflow/i18n";
import { LogInspector } from "./LogInspector";
import { TelegramGate } from "./TelegramGate";
import { auditEntry, type AuditEntry } from "./telegram";
import { AgentNetwork } from "./AgentNetwork";
import { applyEvent, emptyRun, type RunView } from "./runView";

const usd = (n: number) => `$${n.toFixed(2)}`;
const START: CapitalState = { liquid: 4200, pool: 1180, reserved: 0 };

export function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const L = (k: Key, p?: Record<string, string | number>) => t(locale, k, p);

  const [niche, setNiche] = useState("");
  const [tolerance, setTolerance] = useState<RiskTolerance>("MED");
  const [budget, setBudget] = useState(30);
  const [armBug, setArmBug] = useState(false);
  const [step, setStep] = useState(false);

  const [capital, setCapital] = useState<CapitalState>(START);
  const [view, setView] = useState<RunView>(emptyRun());
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const reservation = useRef<Reservation | null>(null);
  const gen = useRef<AsyncGenerator<PipelineEvent> | null>(null);
  const resume = useRef<(() => void) | null>(null);
  const aborted = useRef(false);

  async function run() {
    if (!niche.trim()) return setMessage(L("err.noNiche"));
    let r;
    try { r = reserve(capital, budget); }
    catch (e) { return setMessage(e instanceof InsufficientCapitalError ? L("err.noCapital") : String(e)); }
    setCapital(r.state); reservation.current = r.reservation;
    setMessage(""); setView(emptyRun()); setRunning(true); aborted.current = false;

    const agents = createSimAgents({ seed: Date.now() % 2 ** 31 });
    gen.current = runPipeline({ niche: niche.trim(), tolerance, maxBudget: budget, armBug }, agents);
    let v = emptyRun();
    let state = r.state;
    for await (const e of gen.current) {
      if (aborted.current) break;
      if (step && e.type === "phase" && e.phase > 0) {
        setPaused(e.phase);
        await new Promise<void>((res) => (resume.current = res));
        setPaused(null);
        if (aborted.current) break;
      }
      v = applyEvent(v, e);
      setView(v);
      await new Promise((res) => setTimeout(res, step ? 0 : 350));
      if (e.type === "end" && e.verdict === "KILL" && reservation.current) {
        state = refund(state, reservation.current); reservation.current = null;
        setCapital(state); setMessage(L("killed"));
      }
    }
    const leftover = reservation.current;
    if (aborted.current && leftover) {
      setCapital((c) => refund(c, leftover)); reservation.current = null;
    }
    setRunning(false);
  }

  const abort = () => { aborted.current = true; resume.current?.(); };

  function decide(approve: boolean) {
    const res = reservation.current;
    if (!res || !view.proposal) return;
    if (approve) {
      const net = view.proposal.economics.net;
      setCapital((c) => settle(c, res, net));
      setMessage(L("launched", { net: usd(net) }));
    } else {
      setCapital((c) => refund(c, res));
      setMessage(L("rejected"));
    }
    setAudit((a) => [auditEntry(view.proposal!, approve ? "APPROVED" : "REJECTED"), ...a]);
    reservation.current = null;
    setView((v) => ({ ...v, proposal: undefined }));
  }

  const total = capital.liquid + capital.pool + capital.reserved;
  const phases = [0, 1, 2, 3, 4] as const;

  const card = "rounded-xl border border-line bg-panel/80 p-4";
  const h2 = "mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan/80";
  const field = "w-full rounded-md border border-line bg-navy px-3 py-2 text-[13px] text-ink focus:border-cyan focus:outline-none disabled:opacity-60";
  const btn = "rounded-md border border-cyan/50 px-3 py-1.5 text-[13px] text-cyan transition hover:bg-cyan/15 disabled:cursor-not-allowed disabled:opacity-40";
  const lbl = "mb-1 mt-3 block text-[12px] text-muted";
  const verdictColor = { KILL: "text-magenta", FIX: "text-amber", SHIP: "text-emerald" } as const;

  return (
    <div className="mx-auto grid max-w-[1680px] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_380px]">
      <header className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2 xl:col-span-3">
        <h1 className="text-xl font-bold tracking-wide">{L("title")}</h1>
        <label className="flex items-center gap-2 text-[12px] text-muted">{L("language")}
          <select className={`${field} w-auto`} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            <option value="en">EN</option><option value="vi">VI</option>
          </select>
        </label>
      </header>

      <div className="flex flex-col gap-4">
        <section className={card}>
          <h2 className={h2}>{L("controls")}</h2>
          <label className={lbl}>{L("niche")}</label>
          <input className={field} type="text" value={niche} placeholder={L("nichePh")} onChange={(e) => setNiche(e.target.value)} disabled={running} />
          <label className={lbl}>{L("risk")}</label>
          <select className={field} value={tolerance} onChange={(e) => setTolerance(e.target.value as RiskTolerance)} disabled={running}>
            {(["LOW", "MED", "HIGH"] as const).map((r) => <option key={r} value={r}>{L(`risk.${r}` as Key)}</option>)}
          </select>
          <label className={lbl}>{L("budget")}</label>
          <input className={field} type="number" min={0} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))} disabled={running} />
          <label className="mt-3 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={armBug} onChange={(e) => setArmBug(e.target.checked)} disabled={running} /> {L("armBug")}</label>
          <label className="mt-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={step} onChange={(e) => setStep(e.target.checked)} disabled={running} /> {L("stepMode")}</label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btn} onClick={run} disabled={running}>{L("run")}</button>
            <button className={btn} onClick={() => resume.current?.()} disabled={paused === null}>{L("next")}</button>
            <button className={btn} onClick={abort} disabled={!running}>{L("abort")}</button>
          </div>
          {message && <p className="mt-3 text-[12.5px] text-muted">{message}</p>}
          {paused !== null && <p className="mt-1 text-[12.5px] text-amber">{L("pausedBefore", { n: paused + 1 })}</p>}
        </section>

        <section className={card}>
          <h2 className={h2}>{L("capital")}</h2>
          <div className="font-mono text-4xl font-bold tabular-nums">{usd(total)}</div>
          <dl className="mt-2 space-y-1 font-mono text-[12px] text-muted">
            <div className="flex justify-between"><dt>{L("liquid")}</dt><dd className="text-ink">{usd(capital.liquid)}</dd></div>
            <div className="flex justify-between"><dt>{L("pool")}</dt><dd className="text-emerald">{usd(capital.pool)}</dd></div>
            <div className="flex justify-between"><dt>{L("reserved")}</dt><dd className="text-amber">{usd(capital.reserved)}</dd></div>
          </dl>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <section className={card}>
          <h2 className={h2}>{L("pipeline")}</h2>
          {view.log.length === 0 ? <p className="text-[13px] text-muted">{L("noRun")}</p> : (
            <>
              <ol className="flex flex-wrap gap-2">
                {phases.map((p) => {
                  const on = view.phase === p && !view.ended;
                  const done = view.phase !== null && view.phase >= p && !on;
                  return (
                    <li key={p} className={`rounded-full border px-3 py-1 text-[12px] ${on ? "border-cyan text-cyan shadow-glowCyan" : done ? "border-emerald/40 text-emerald" : "border-line text-muted"}`}>
                      {p + 1}. {L(`phase.${p}` as Key)}
                    </li>
                  );
                })}
              </ol>
              {view.decision && <div className={`mt-4 text-4xl font-bold ${verdictColor[view.decision.verdict]}`}>{L(`verdict.${view.decision.verdict}` as Key)}</div>}
              <div className="mt-3 space-y-1 font-mono text-[12.5px] text-muted">
                {view.market && <p>score {view.market.score} · competition {view.market.competition}/100{view.market.redFlag ? " · red flag" : ""}</p>}
                {view.riskScore !== undefined && <p>{L("riskScore")}: {view.riskScore}/10</p>}
                {view.economics && <p>{L("netMargin")}: {view.economics.marginPct.toFixed(1)}% · net {usd(view.economics.net)}</p>}
                {view.qa.map((q) => <p key={q.attempt} className={q.result.pass ? "text-emerald" : "text-amber"}>{L("attempt", { n: q.attempt })}: {q.result.pass ? "PASS" : q.result.error}</p>)}
              </div>
            </>
          )}
        </section>
        <section className={card}>
          <h2 className={h2}>{L("agentNet")}</h2>
          <AgentNetwork view={view} locale={locale} />
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1">
        <section className={card}>
          <h2 className={h2}>{L("telegram")}</h2>
          <TelegramGate proposal={view.proposal} audit={audit} locale={locale} onDecide={decide} />
        </section>
      <section className={`${card} min-w-0`}>
        <h2 className={h2}>{L("logs")}</h2>
        <LogInspector log={view.log} locale={locale} onClear={() => setView((v) => ({ ...v, log: [] }))} />
      </section>
      </div>
      <footer className="text-[12px] text-muted lg:col-span-2 xl:col-span-3">{L("footer")}</footer>
    </div>
  );
}
