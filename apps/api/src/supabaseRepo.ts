import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { InsufficientCapitalError } from "@autoflow/engine";
import type { PipelineEvent } from "@autoflow/engine";
import { ConflictError, NotFoundError, type ApprovalRow, type LedgerRow, type ProjectRow, type Repo, type RunRow } from "./repo";

/** Money-moving steps run inside Postgres functions (db/migrations/0002), so they stay atomic under concurrency. */
function mapError(e: { message: string }): never {
  const m = e.message;
  if (m.includes("insufficient_capital")) throw new InsufficientCapitalError(0, 0); // amounts unknown here; the DB only reports the condition
  if (m.includes("not_found")) throw new NotFoundError(m);
  if (m.includes("conflict") || m.includes("already_reserved")) throw new ConflictError(m);
  throw new Error(m);
}

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) mapError(r.error);
  return r.data as T;
};

const toRun = (r: any): RunRow => ({
  id: r.id, niche: r.niche, tolerance: r.tolerance, maxBudgetCents: Number(r.max_budget_cents), seed: Number(r.seed ?? 0),
  status: r.status === "paused" ? "running" : r.status, verdict: r.verdict ?? undefined, createdAt: r.created_at,
});
const toProject = (r: any): ProjectRow => ({
  id: r.id, runId: r.run_id, niche: r.niche, status: r.status, budgetCents: Number(r.budget_cents),
  projectedNetCents: Number(r.projected_net_cents ?? 0), marginPct: Number(r.margin_pct ?? 0), riskScore: Number(r.risk_score ?? 0),
});
const toApproval = (r: any): ApprovalRow => ({ id: Number(r.id), projectId: r.project_id, action: r.action, decidedBy: r.decided_by, createdAt: r.created_at });
const toLedger = (r: any): LedgerRow => ({ id: Number(r.id), projectId: r.project_id ?? undefined, kind: r.kind, bucket: r.bucket, amountCents: Number(r.amount_cents), createdAt: r.created_at });

export function createSupabaseRepo(client: SupabaseClient): Repo {
  const rpc = async (fn: string, args: Record<string, unknown>) => must(await client.rpc(fn, args));
  return {
    async balances() {
      const [liquid, pool, reserved] = await Promise.all(["liquid", "pool", "reserved"].map(async (b) => Number(await rpc("capital_balance", { p_bucket: b }))));
      return { liquid: liquid!, pool: pool!, reserved: reserved! };
    },
    async deposit(bucket, cents) {
      must(await client.from("capital_ledger").insert({ kind: "deposit", bucket, amount_cents: cents }));
    },
    async reserveForRun(runId, cents) { await rpc("reserve_for_run", { p_run: runId, p_cents: cents }); },
    async createRun(input) {
      const row = must(await client.from("runs").insert({
        niche: input.niche, tolerance: input.tolerance, max_budget_cents: input.maxBudgetCents, seed: input.seed,
      }).select().single());
      return toRun(row);
    },
    async appendEvent(runId, e) {
      const last = must(await client.from("events").select("seq").eq("run_id", runId).order("seq", { ascending: false }).limit(1));
      const seq = ((last as any[])[0]?.seq ?? 0) + 1;
      must(await client.from("events").insert({ run_id: runId, seq, type: e.type, payload: e }));
    },
    async listEvents(runId, afterSeq = 0) {
      const rows = must(await client.from("events").select("seq,payload").eq("run_id", runId).gt("seq", afterSeq).order("seq"));
      return (rows as any[]).map((r) => ({ seq: r.seq as number, event: r.payload as PipelineEvent }));
    },
    async getRun(id) {
      const r = must(await client.from("runs").select().eq("id", id).maybeSingle());
      if (!r) throw new NotFoundError(id);
      return toRun(r);
    },
    async finishRun(id, verdict) {
      must(await client.from("runs").update({ status: "ended", verdict, ended_at: new Date().toISOString() }).eq("id", id));
    },
    async createProject(p) {
      const row = must(await client.from("projects").insert({
        run_id: p.runId, niche: p.niche, budget_cents: p.budgetCents, projected_net_cents: p.projectedNetCents,
        margin_pct: p.marginPct, risk_score: p.riskScore,
      }).select().single());
      return toProject(row);
    },
    async listProposals() {
      return (must(await client.from("projects").select().eq("status", "proposed").order("created_at")) as any[]).map(toProject);
    },
    async release(runId) { await rpc("release_run", { p_run: runId }); },
    async decide(projectId, action, decidedBy) {
      return toApproval(await rpc("decide_proposal", { p_project: projectId, p_action: action, p_by: decidedBy }));
    },
    async ledger() {
      return (must(await client.from("capital_ledger").select().order("id")) as any[]).map(toLedger);
    },
    async approvals() {
      return (must(await client.from("approvals").select().order("id")) as any[]).map(toApproval);
    },
  };
}

/** Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment; never log or commit them. */
export function createSupabaseRepoFromEnv(env = process.env): Repo {
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return createSupabaseRepo(createClient(url, key, { auth: { persistSession: false } }));
}
