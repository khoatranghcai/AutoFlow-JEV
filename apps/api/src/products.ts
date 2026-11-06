import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { ProductBundle, PromptPack, QcReport } from "@autoflow/engine";
import { ConflictError, NotFoundError } from "./repo";

export interface ProductRow {
  id: string;
  kind: "prompt_pack";
  niche: string;
  title: string;
  priceCents: number;
  qcScore: number;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
}
export interface ProductDetail extends ProductRow { pack: PromptPack; qc: QcReport; bundle: ProductBundle; markdown: string }
export type NewProduct = { niche: string; pack: PromptPack; qc: QcReport; bundle: ProductBundle; markdown: string };

/** Review queue for built products. Deciding is allowed exactly once and never moves money or publishes. */
export interface ProductStore {
  add(p: NewProduct): Promise<ProductRow>;
  list(): Promise<ProductRow[]>;
  get(id: string): Promise<ProductDetail>;
  decide(id: string, action: "approved" | "rejected", decidedBy: string): Promise<ProductRow>;
}

const toRow = (d: ProductDetail): ProductRow => {
  const { pack, qc, bundle, markdown, ...row } = d;
  void pack; void qc; void bundle; void markdown;
  return row;
};

export function createMemoryProductStore(): ProductStore {
  const items = new Map<string, ProductDetail>();
  return {
    async add(p) {
      const d: ProductDetail = {
        id: randomUUID(), kind: "prompt_pack", niche: p.niche, title: p.bundle.title, priceCents: p.bundle.priceCents,
        qcScore: p.qc.score, status: "pending", createdAt: new Date().toISOString(),
        pack: p.pack, qc: p.qc, bundle: p.bundle, markdown: p.markdown,
      };
      items.set(d.id, d);
      return toRow(d);
    },
    async list() { return [...items.values()].map(toRow).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async get(id) { const d = items.get(id); if (!d) throw new NotFoundError("not_found"); return d; },
    async decide(id, action, decidedBy) {
      const d = items.get(id);
      if (!d) throw new NotFoundError("not_found");
      if (d.status !== "pending") throw new ConflictError("already_decided");
      d.status = action; d.decidedBy = decidedBy; d.decidedAt = new Date().toISOString();
      return toRow(d);
    },
  };
}

const fromDb = (r: any): ProductRow => ({
  id: r.id, kind: r.kind, niche: r.niche, title: r.title, priceCents: Number(r.price_cents), qcScore: Number(r.qc_score),
  status: r.status, decidedBy: r.decided_by ?? undefined, decidedAt: r.decided_at ?? undefined, createdAt: r.created_at,
});
const LIST_COLS = "id,kind,niche,title,price_cents,qc_score,status,decided_by,decided_at,created_at";

export function createSupabaseProductStore(url: string, serviceKey: string): ProductStore {
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const fail = (e: { message: string }): never => { throw new Error(e.message); };
  return {
    async add(p) {
      const { data, error } = await db.from("products").insert({
        kind: "prompt_pack", niche: p.niche, title: p.bundle.title, price_cents: p.bundle.priceCents, qc_score: p.qc.score,
        content: { pack: p.pack, qc: p.qc, bundle: p.bundle }, markdown: p.markdown,
      }).select(LIST_COLS).single();
      if (error) fail(error);
      return fromDb(data);
    },
    async list() {
      const { data, error } = await db.from("products").select(LIST_COLS).order("created_at", { ascending: false }).limit(100);
      if (error) fail(error);
      return (data ?? []).map(fromDb);
    },
    async get(id) {
      const { data, error } = await db.from("products").select("*").eq("id", id).maybeSingle();
      if (error) fail(error);
      if (!data) throw new NotFoundError("not_found");
      return { ...fromDb(data), pack: data.content.pack, qc: data.content.qc, bundle: data.content.bundle, markdown: data.markdown };
    },
    async decide(id, action, decidedBy) {
      // Conditional update: only a pending row can be decided, so two reviewers cannot both win.
      const { data, error } = await db.from("products")
        .update({ status: action, decided_by: decidedBy, decided_at: new Date().toISOString() })
        .eq("id", id).eq("status", "pending").select(LIST_COLS);
      if (error) fail(error);
      if (data && data.length) return fromDb(data[0]);
      const { data: ex } = await db.from("products").select("id").eq("id", id).maybeSingle();
      throw ex ? new ConflictError("already_decided") : new NotFoundError("not_found");
    },
  };
}

export function createProductStoreFromEnv(env = process.env): ProductStore {
  return env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseProductStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : createMemoryProductStore();
}
