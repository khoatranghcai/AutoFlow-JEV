import type { CapitalState, NicheIdea, PipelineEvent } from "@autoflow/engine";

/** Live mode talks to the Fastify API through the Vite dev proxy (/api -> 127.0.0.1:8787). Off by default: the dashboard stays a pure simulation. */
export const LIVE = import.meta.env.VITE_LIVE_API === "1";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: { "content-type": "application/json" }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? "error");
  return body as T;
}

const dollars = (cents: number) => cents / 100;

export interface RunInput { niche: string; tolerance: "LOW" | "MED" | "HIGH"; maxBudgetUsd: number; armBug: boolean }
export interface LiveRun { id: string; verdict?: "KILL" | "FIX" | "SHIP" }
export interface LiveProject { id: string; runId: string }

/** Balances come back in integer cents; the UI works in dollars. */
export async function getCapital(): Promise<CapitalState> {
  const c = await call<CapitalState>("/capital");
  return { liquid: dollars(c.liquid), pool: dollars(c.pool), reserved: dollars(c.reserved) };
}

export const startRun = (input: RunInput) => call<LiveRun>("/runs", { method: "POST", body: JSON.stringify(input) });
export const getEvents = async (runId: string) =>
  (await call<{ seq: number; event: PipelineEvent }[]>(`/runs/${runId}/events`)).map((r) => r.event);
export const getProposals = () => call<LiveProject[]>("/proposals");
export const decideProposal = (projectId: string, approve: boolean, decidedBy: string) =>
  call(`/proposals/${projectId}/${approve ? "approve" : "reject"}`, { method: "POST", body: JSON.stringify({ decidedBy }) });

/** Which storage the API is using ("supabase" or "in-memory"), so the UI can say what is really live. */
export const getBackend = async () => (await call<{ backend?: string }>("/health")).backend ?? "unknown";

export interface NicheSuggestion { source: "claude" | "catalog"; ideas: NicheIdea[]; note?: string }
/** AI suggestions when the API has an ANTHROPIC_API_KEY, otherwise (or on limits/errors) the static catalog. */
export const suggestNiches = (exclude: string[] = []) =>
  call<NicheSuggestion>("/niches/suggest", { method: "POST", body: JSON.stringify({ count: 6, exclude }) });

export interface ProductItem {
  id: string; kind: ProductKind; niche: string; title: string; priceCents: number; qcScore: number;
  status: "pending" | "approved" | "rejected"; decidedBy?: string; createdAt: string;
}
export const listProducts = () => call<ProductItem[]>("/products");
export const getProductMarkdown = async (id: string) => (await call<{ markdown: string }>(`/products/${id}`)).markdown;
export type ProductKind = "prompt_pack" | "sheet_template" | "checklist";
export const buildProduct = (kind: ProductKind, niche: string) =>
  call<{ product: ProductItem }>(`/products/${{ prompt_pack: "prompt-pack", sheet_template: "sheet-template", checklist: "checklist" }[kind]}`, { method: "POST", body: JSON.stringify({ niche }) });
export const decideProduct = (id: string, approve: boolean, decidedBy: string) =>
  call<ProductItem>(`/products/${id}/${approve ? "approve" : "reject"}`, { method: "POST", body: JSON.stringify({ decidedBy }) });
