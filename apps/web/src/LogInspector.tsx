import { useMemo, useState } from "react";
import type { PipelineEvent } from "@autoflow/engine";
import { t, type Key, type Locale } from "@autoflow/i18n";
import { filterLog, levelOf, type LogLevel } from "./logFilter";

const COLOR: Record<LogLevel, string> = { info: "text-muted", success: "text-emerald", warn: "text-amber", error: "text-magenta" };
const LEVELS = ["all", "info", "success", "warn", "error"] as const;

export function LogInspector({ log, locale, onClear }: { log: PipelineEvent[]; locale: Locale; onClear: () => void }) {
  const [text, setText] = useState("");
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [copied, setCopied] = useState(false);
  const shown = useMemo(() => filterLog(log, { text, level }), [log, text, level]);
  const btn = "rounded-md border border-cyan/50 px-2 py-1 text-[12px] text-cyan hover:bg-cyan/15";

  async function copy() {
    try { await navigator.clipboard.writeText(JSON.stringify(shown, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked: the JSON stays selectable in the panel */ }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        <input className="min-w-0 flex-1 rounded-md border border-line bg-navy px-2 py-1 text-[12px] focus:border-cyan focus:outline-none" value={text} placeholder={t(locale, "filterPh")} onChange={(e) => setText(e.target.value)} />
        <select className="rounded-md border border-line bg-navy px-2 py-1 text-[12px]" value={level} onChange={(e) => setLevel(e.target.value as LogLevel | "all")}>
          {LEVELS.map((l) => <option key={l} value={l}>{l === "all" ? t(locale, "all") : t(locale, `lvl.${l}` as Key)}</option>)}
        </select>
        <button className={btn} onClick={copy} disabled={shown.length === 0}>{copied ? t(locale, "copied") : t(locale, "copyJson")}</button>
        <button className={btn} onClick={onClear} disabled={log.length === 0}>{t(locale, "clearLogs")}</button>
      </div>
      <ul className="max-h-[520px] space-y-2 overflow-auto">
        {shown.length === 0 && <li className="text-[12.5px] text-muted">{t(locale, "noLogs")}</li>}
        {shown.map((e, i) => (
          <li key={i} className="rounded-md bg-navy p-2">
            <div className={`font-mono text-[11px] uppercase tracking-widest ${COLOR[levelOf(e)]}`}>{t(locale, `lvl.${levelOf(e)}` as Key)} · {e.type}</div>
            <pre className="overflow-auto font-mono text-[11.5px] leading-snug text-muted">{JSON.stringify(e)}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
