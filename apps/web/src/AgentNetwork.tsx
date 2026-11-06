import type { Key, Locale } from "@autoflow/i18n";
import { t } from "@autoflow/i18n";
import { AGENTS, agentState, type AgentState } from "./agentStatus";
import type { RunView } from "./runView";

const DOT: Record<AgentState, string> = {
  idle: "bg-muted/40",
  active: "bg-cyan shadow-glowCyan animate-pulse",
  done: "bg-emerald shadow-glowEmerald",
  error: "bg-magenta shadow-glowMagenta",
  warn: "bg-amber shadow-glowAmber animate-pulse",
};

export function AgentNetwork({ view, locale }: { view: RunView; locale: Locale }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {AGENTS.map((id) => {
        const s = agentState(id, view);
        return (
          <li key={id} className="flex items-center gap-3 rounded-lg border border-line bg-navy/60 px-3 py-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[s]}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[12.5px]">{id}</span>
              <span className="block truncate text-[11px] text-muted">{t(locale, `role.${id}` as Key)}</span>
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-muted">{t(locale, `st.${s}` as Key)}</span>
          </li>
        );
      })}
    </ul>
  );
}
