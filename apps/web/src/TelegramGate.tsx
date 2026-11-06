import { t, type Locale } from "@autoflow/i18n";
import type { PipelineEvent } from "@autoflow/engine";
import { proposalMessage, type AuditEntry } from "./telegram";

type Proposal = Extract<PipelineEvent, { type: "proposal" }>;

/** Simulated Telegram approval gate. Nothing is sent anywhere; the real bot comes later. */
export function TelegramGate({ proposal, audit, locale, onDecide }: { proposal?: Proposal; audit: AuditEntry[]; locale: Locale; onDecide: (approve: boolean) => void }) {
  return (
    <div className="rounded-lg bg-[#0e1621] p-3">
      {!proposal ? <p className="text-[12.5px] text-[#6c7883]">{t(locale, "noProposals")}</p> : (
        <div className="max-w-[92%] rounded-xl rounded-bl-sm bg-[#182533] p-3 text-[13px] text-[#e9eef3]">
          <div className="mb-1 font-semibold text-[#64b5ef]">{t(locale, "shipReady")}</div>
          <pre className="whitespace-pre-wrap font-body text-[12.5px] text-[#aab6c2]">{proposalMessage(proposal)}</pre>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded-md bg-[#2b5278]/70 px-2 py-1.5 text-[12.5px] hover:bg-[#2b5278]" onClick={() => onDecide(true)}>{t(locale, "approve")}</button>
            <button className="rounded-md bg-[#2b5278]/70 px-2 py-1.5 text-[12.5px] hover:bg-[#5a2236]" onClick={() => onDecide(false)}>{t(locale, "reject")}</button>
          </div>
        </div>
      )}
      {audit.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <div className="mb-1 font-mono text-[10.5px] uppercase tracking-widest text-muted">{t(locale, "auditTrail")}</div>
          <ul className="space-y-1 font-mono text-[11.5px] text-[#aab6c2]">
            {audit.map((a, i) => (
              <li key={i}><span className={a.action === "APPROVED" ? "text-emerald" : "text-magenta"}>{a.action}</span> · {a.niche} · {a.at.slice(11, 19)}Z</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
