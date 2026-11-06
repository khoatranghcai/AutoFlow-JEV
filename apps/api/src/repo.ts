import { randomUUID } from "node:crypto";
import { RULES } from "@autoflow/config";
import { InsufficientCapitalError, refund, reserve, settle, total, type CapitalState, type PipelineEvent, type Reservation } from "@autoflow/engine";

/** All money in this layer is integer cents; the engine functions are unit-agnostic. */
export type Cents = number;

export interface RunRow {
  id: string;
  niche: string;
  tolerance: "LOW" | "MED" | "HIGH";
  maxBudgetCents: Cents;
  seed: number;
  status: "running" | "ended" | "aborted";
  verdict?: "KILL" | "FIX" | "SHIP";
  createdAt: string;
}

export interface ProjectRow {
  id: string;
  runId: string;
  niche: string;
  status: "proposed" | "approved" | "rejected" | "killed";
  budgetCents: Cents;
  projectedNetCents: Cents;
  marginPct: number;
  riskScore: number;
}

export interface ApprovalRow { id: number; projectId: string; action: "APPROVED" | "REJECTED"; decidedBy: string; createdAt: string }
export interface LedgerRow { id: number; projectId?: string; kind: "deposit" | "reserve" | "refund" | "settle_profit" | "settle_loss"; bucket: "liquid" | "pool" | "reserved"; amountCents: Cents; createdAt: string }

export class ConflictError extends Error {}
export class NotFoundError extends Error {}

/** Storage seam. The in-memory version is for tests and local use; a Supabase version implements the same interface. */
export interface Repo {
  balances(): Promise<CapitalState>;
  deposit(bucket: "liquid" | "pool", cents: Cents): Promise<void>;
  reserveForRun(runId: string, cents: Cents): Promise<void>;
  createRun(input: Pick<RunRow, "niche" | "tolerance" | "maxBudgetCents" | "seed">): Promise<RunRow>;
  appendEvent(runId: string, e: PipelineEvent): Promise<void>;
  listEvents(runId: string, afterSeq?: number): Promise<{ seq: number; event: PipelineEvent }[]>;
  getRun(id: string): Promise<RunRow>;
  finishRun(id: string, verdict: RunRow["verdict"]): Promise<void>;
  createProject(p: Omit<ProjectRow, "id" | "status">): Promise<ProjectRow>;
  listProposals(): Promise<ProjectRow[]>;
  /** Refund the reserved budget (KILL or abort). */
  release(runId: string): Promise<void>;
  /** Record a human decision exactly once and move money accordingly. */
  decide(projectId: string, action: "APPROVED" | "REJECTED", decidedBy: string): Promise<ApprovalRow>;
  ledger(): Promise<LedgerRow[]>;
  approvals(): Promise<ApprovalRow[]>;
}

export function createMemoryRepo(): Repo {
  const ledger: LedgerRow[] = [];
  const runs = new Map<string, RunRow>();
  const events = new Map<string, { seq: number; event: PipelineEvent }[]>();
  const projects = new Map<string, ProjectRow>();
  const approvals: ApprovalRow[] = [];
  const reservations = new Map<string, Reservation>(); // by run id
  let ledgerId = 0, approvalId = 0;
  const now = () => new Date().toISOString();

  const post = (kind: LedgerRow["kind"], bucket: LedgerRow["bucket"], amountCents: Cents, projectId?: string) => {
    if (amountCents !== 0) ledger.push({ id: ++ledgerId, projectId, kind, bucket, amountCents, createdAt: now() });
  };
  const balances = (): CapitalState => {
    const s: CapitalState = { liquid: 0, pool: 0, reserved: 0 };
    for (const r of ledger) s[r.bucket] += r.amountCents;
    return s;
  };

  /** Write the ledger rows that turn `before` into `after`, so balances always derive from the ledger. */
  const move = (kind: LedgerRow["kind"], before: CapitalState, after: CapitalState, projectId?: string) => {
    post(kind, "liquid", after.liquid - before.liquid, projectId);
    post(kind, "pool", after.pool - before.pool, projectId);
    post(kind, "reserved", after.reserved - before.reserved, projectId);
  };

  return {
    async balances() { return balances(); },
    async deposit(bucket, cents) { post("deposit", bucket, cents); },
    async createRun(input) {
      const row: RunRow = { id: randomUUID(), ...input, status: "running", createdAt: now() };
      runs.set(row.id, row); events.set(row.id, []);
      return row;
    },
    async reserveForRun(runId, cents) {
      const before = balances();
      const r = reserve(before, cents); // throws InsufficientCapitalError
      reservations.set(runId, r.reservation);
      move("reserve", before, r.state);
    },
    async appendEvent(runId, event) {
      const list = events.get(runId);
      if (!list) throw new NotFoundError(runId);
      list.push({ seq: list.length + 1, event });
    },
    async listEvents(runId, afterSeq = 0) {
      const list = events.get(runId);
      if (!list) throw new NotFoundError(runId);
      return list.filter((e) => e.seq > afterSeq);
    },
    async getRun(id) {
      const r = runs.get(id);
      if (!r) throw new NotFoundError(id);
      return { ...r };
    },
    async finishRun(id, verdict) {
      const r = runs.get(id);
      if (!r) throw new NotFoundError(id);
      r.status = "ended"; r.verdict = verdict;
    },
    async createProject(p) {
      const row: ProjectRow = { id: randomUUID(), status: "proposed", ...p };
      projects.set(row.id, row);
      return row;
    },
    async listProposals() { return [...projects.values()].filter((p) => p.status === "proposed"); },
    async release(runId) {
      const res = reservations.get(runId);
      if (!res) return; // already released or settled: releasing twice must not refund twice
      reservations.delete(runId);
      const before = balances();
      move("refund", before, refund(before, res));
    },
    async decide(projectId, action, decidedBy) {
      const p = projects.get(projectId);
      if (!p) throw new NotFoundError(projectId);
      if (p.status !== "proposed") throw new ConflictError(`project already ${p.status}`);
      const res = reservations.get(p.runId);
      if (!res) throw new ConflictError("no reserved budget for this project");
      reservations.delete(p.runId);
      const before = balances();
      if (action === "APPROVED") {
        // Net already accounts for the ad spend. Profit: 80% to the pool, the rest to liquid; a loss comes out of liquid.
        const after = settle(before, res, p.projectedNetCents);
        const pool = Math.round(after.pool);
        const settled = { ...after, pool, liquid: total(before) + p.projectedNetCents - pool - after.reserved };
        move(p.projectedNetCents >= 0 ? "settle_profit" : "settle_loss", before, settled, p.id);
        p.status = "approved";
      } else {
        move("refund", before, refund(before, res), p.id);
        p.status = "rejected";
      }
      const row: ApprovalRow = { id: ++approvalId, projectId, action, decidedBy, createdAt: now() };
      approvals.push(row);
      return row;
    },
    async ledger() { return [...ledger]; },
    async approvals() { return [...approvals]; },
  };
}

export { InsufficientCapitalError, RULES };
