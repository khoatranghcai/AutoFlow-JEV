import { useEffect, useState } from "react";
import { t, type Locale } from "@autoflow/i18n";
import * as api from "./apiClient";

const btn = "rounded-md border border-cyan/50 px-3 py-1.5 text-[13px] text-cyan transition hover:bg-cyan/15 disabled:cursor-not-allowed disabled:opacity-40";
const field = "w-full rounded-md border border-line bg-navy px-3 py-2 text-[13px] text-ink focus:border-cyan focus:outline-none disabled:opacity-60";

/** Review queue for Builder products (live mode). Approve means "ready to list": no publishing, no money. */
export function ProductsPanel({ locale, initialNiche }: { locale: Locale; initialNiche: string }) {
  const [items, setItems] = useState<api.ProductItem[]>([]);
  const [niche, setNiche] = useState(initialNiche);
  const [kind, setKind] = useState<api.ProductKind>("prompt_pack");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(null);

  const refresh = () => api.listProducts().then(setItems).catch(() => setItems([]));
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (initialNiche) setNiche(initialNiche); }, [initialNiche]);

  async function build() {
    setBusy(true); setError("");
    try { await api.buildProduct(kind, niche); await refresh(); }
    catch (e) {
      const code = e instanceof api.ApiError ? e.code : "network";
      setError(code === "no_api_key" || (e instanceof api.ApiError && e.status === 503) ? t(locale, "products.err.no_api_key") : t(locale, "products.err.generic", { reason: code }));
    } finally { setBusy(false); }
  }
  async function decide(id: string, approve: boolean) {
    try { await api.decideProduct(id, approve, "dashboard"); await refresh(); } catch { await refresh(); }
  }
  async function toggle(id: string) {
    if (preview?.id === id) return setPreview(null);
    setPreview({ id, text: await api.getProductMarkdown(id) });
  }

  return (
    <div>
      <p className="mb-2 text-[12px] text-muted">{t(locale, "products.hint")}</p>
      <label className="mb-1 block text-[12px] text-muted">{t(locale, "products.kindLabel")}</label>
      <select className={field} value={kind} onChange={(e) => setKind(e.target.value as api.ProductKind)} disabled={busy}>
        <option value="prompt_pack">{t(locale, "products.kind.prompt_pack")}</option>
        <option value="sheet_template">{t(locale, "products.kind.sheet_template")}</option>
      </select>
      <label className="mb-1 mt-2 block text-[12px] text-muted">{t(locale, "products.niche")}</label>
      <input className={field} value={niche} onChange={(e) => setNiche(e.target.value)} disabled={busy} />
      <button className={`${btn} mt-2`} onClick={build} disabled={busy || niche.trim().length < 3}>{busy ? t(locale, "products.building") : t(locale, "products.build")}</button>
      {error && <p className="mt-2 text-[12px] text-magenta">{error}</p>}
      {items.length === 0 ? <p className="mt-3 text-[12.5px] text-muted">{t(locale, "products.empty")}</p> : (
        <ul className="mt-3 space-y-2">
          {items.map((p) => (
            <li key={p.id} className="rounded-md border border-line p-2 text-[12.5px]">
              <div className="font-semibold text-ink">{p.title} <span className="font-normal text-muted">· {t(locale, `products.kind.${p.kind}` as never)}</span></div>
              <div className="text-muted">${(p.priceCents / 100).toFixed(2)} · {t(locale, "products.qc", { n: p.qcScore })} · <span className={p.status === "approved" ? "text-emerald" : p.status === "rejected" ? "text-magenta" : "text-amber"}>{t(locale, `products.status.${p.status}` as never)}</span></div>
              <div className="mt-1 flex gap-2">
                <button className={btn} onClick={() => toggle(p.id)}>{t(locale, "products.view")}</button>
                {p.status === "pending" && <>
                  <button className={btn} onClick={() => decide(p.id, true)}>{t(locale, "approve")}</button>
                  <button className={btn} onClick={() => decide(p.id, false)}>{t(locale, "reject")}</button>
                </>}
              </div>
              {preview?.id === p.id && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-navy p-2 font-mono text-[11.5px] text-[#aab6c2]">{preview.text}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
