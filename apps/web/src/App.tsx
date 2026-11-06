import { useRef, useState } from "react";
import { createSimAgents } from "@autoflow/agents";
import type { RiskTolerance } from "@autoflow/config";
import { InsufficientCapitalError, refund, reserve, runPipeline, settle, type CapitalState, type PipelineEvent, type Reservation } from "@autoflow/engine";
import { t, type Key, type Locale } from "@autoflow/i18n";
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
    if (aborted.current && reservation.current) {
      setCapital((c) => refund(c, reservation.current!)); reservation.current = null;
    }
    setRunning(false);
  }

  const abort = () => { aborted.current = true; resume.current?.(); };

  function decide(approve: boolean) {
    if (!reservation.current || !view.proposal) return;
    if (approve) {
      const net = view.proposal.economics.net;
      setCapital((c) => settle(c, reservation.current!, net));
      setMessage(L("launched", { net: usd(net) }));
    } else {
      setCapital((c) => refund(c, reservation.current!));
      setMessage(L("rejected"));
    }
    reservation.current = null;
    setView((v) => ({ ...v, proposal: undefined }));
  }

  const total = capital.liquid + capital.pool + capital.reserved;
  const phases = [0, 1, 2, 3, 4] as const;

  return (
    <div className="wrap">
      <header>
        <h1>{L("title")}</h1>
        <label style={{ margin: 0 }}>{L("language")}{" "}
          <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} style={{ width: "auto" }}>
            <option value="en">EN</option><option value="vi">VI</option>
          </select>
        </label>
      </header>

      <section className="panel">
        <h2>{L("controls")}</h2>
        <label>{L("niche")}</label>
        <input type="text" value={niche} placeholder={L("nichePh")} onChange={(e) => setNiche(e.target.value)} disabled={running} />
        <label>{L("risk")}</label>
        <select value={tolerance} onChange={(e) => setTolerance(e.target.value as RiskTolerance)} disabled={running}>
          {(["LOW", "MED", "HIGH"] as const).map((r) => <option key={r} value={r}>{L(`risk.${r}` as Key)}</option>)}
        </select>
        <label>{L("budget")}</label>
        <input type="number" min={0} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))} disabled={running} />
        <label><input type="checkbox" checked={armBug} onChange={(e) => setArmBug(e.target.checked)} disabled={running} /> {L("armBug")}</label>
        <label><input type="checkbox" checked={step} onChange={(e) => setStep(e.target.checked)} disabled={running} /> {L("stepMode")}</label>
        <button onClick={run} disabled={running}>{L("run")}</button>
        <button onClick={() => resume.current?.()} disabled={paused === null}>{L("next")}</button>
        <button onClick={abort} disabled={!running}>{L("abort")}</button>
        {message && <p className="muted">{message}</p>}
        {paused !== null && <p className="muted">{L("pausedBefore", { n: paused + 1 })}</p>}
      </section>

      <section className="panel">
        <h2>{L("capital")}</h2>
        <div className="big">{usd(total)}</div>
        <div className="muted">{L("liquid")}: {usd(capital.liquid)}</div>
        <div className="muted">{L("pool")}: {usd(capital.pool)}</div>
        <div className="muted">{L("reserved")}: {usd(capital.reserved)}</div>
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>{L("pipeline")}</h2>
        {view.log.length === 0 ? <p className="muted">{L("noRun")}</p> : (
          <>
            <div className="phases">
              {phases.map((p) => (
                <span key={p} className={`phase ${view.phase === p && !view.ended ? "on" : view.phase !== null && view.phase >= p ? "done" : ""}`}>
                  {p + 1}. {L(`phase.${p}` as Key)}
                </span>
              ))}
            </div>
            {view.decision && <div className={`big ${view.decision.verdict}`}>{L(`verdict.${view.decision.verdict}` as Key)}</div>}
            {view.market && <p className="muted">score {view.market.score} · competition {view.market.competition}/100{view.market.redFlag ? " · red flag" : ""}</p>}
            {view.riskScore !== undefined && <p className="muted">{L("riskScore")}: {view.riskScore}/10</p>}
            {view.economics && <p className="muted">{L("netMargin")}: {view.economics.marginPct.toFixed(1)}% · net {usd(view.economics.net)}</p>}
            {view.qa.map((q) => <p key={q.attempt} className={q.result.pass ? "SHIP" : "FIX"}>{L("attempt", { n: q.attempt })}: {q.result.pass ? "PASS" : q.result.error}</p>)}
            {view.proposal && (
              <div>
                <h2>{L("proposal")}</h2>
                <p>{view.proposal.niche} · {usd(view.proposal.budget)} · net {usd(view.proposal.economics.net)}</p>
                <button onClick={() => decide(true)}>{L("approve")}</button>
                <button onClick={() => decide(false)}>{L("reject")}</button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>{L("logs")}</h2>
        <pre>{JSON.stringify(view.log, null, 2)}</pre>
      </section>
      <footer>{L("footer")}</footer>
    </div>
  );
}
