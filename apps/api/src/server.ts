import Fastify from "fastify";
import { z } from "zod";
import { createSimAgents } from "@autoflow/agents";
import { InsufficientCapitalError, runPipeline } from "@autoflow/engine";
import { ConflictError, NotFoundError, type Repo } from "./repo";

export interface ServerOptions {
  repo: Repo;
  /** Hard cap on a single test budget, in cents. Enforced here, before any money is reserved. */
  maxRunBudgetCents?: number;
  /** Reported by /health so operators can see which storage is live. */
  backend?: "supabase" | "in-memory";
}

const RunBody = z.object({
  niche: z.string().trim().min(1).max(200),
  tolerance: z.enum(["LOW", "MED", "HIGH"]).default("MED"),
  maxBudgetUsd: z.number().nonnegative(),
  armBug: z.boolean().default(false),
  seed: z.number().int().optional(),
});
const DecisionBody = z.object({ decidedBy: z.string().trim().min(1).max(100) });

export function buildServer({ repo, maxRunBudgetCents = 5_000, backend = "in-memory" }: ServerOptions) {
  const app = Fastify();

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    if (err instanceof z.ZodError) return reply.code(400).send({ error: "invalid_request", issues: err.issues });
    if (err instanceof NotFoundError) return reply.code(404).send({ error: "not_found" });
    if (err instanceof ConflictError) return reply.code(409).send({ error: "conflict", message: err.message });
    if (err instanceof InsufficientCapitalError) return reply.code(409).send({ error: "insufficient_capital", message: err.message });
    return reply.code(err.statusCode ?? 500).send({ error: "internal_error" });
  });

  app.get("/health", async () => ({ ok: true, backend }));

  app.get("/capital", async () => repo.balances());

  app.post("/runs", async (req, reply) => {
    const body = RunBody.parse(req.body);
    const budgetCents = Math.round(body.maxBudgetUsd * 100);
    if (budgetCents > maxRunBudgetCents) {
      return reply.code(422).send({ error: "budget_over_cap", capCents: maxRunBudgetCents });
    }
    const seed = body.seed ?? Math.floor(Math.random() * 2 ** 31);
    const run = await repo.createRun({ niche: body.niche, tolerance: body.tolerance, maxBudgetCents: budgetCents, seed });
    await repo.reserveForRun(run.id, budgetCents); // throws when there is not enough free capital

    // Simulation mode: runs to completion within the request. Money is only ever reserved here, never spent.
    let verdict: "KILL" | "FIX" | "SHIP" | undefined;
    const input = { niche: body.niche, tolerance: body.tolerance, maxBudget: body.maxBudgetUsd, armBug: body.armBug };
    for await (const e of runPipeline(input, createSimAgents({ seed }))) {
      await repo.appendEvent(run.id, e);
      if (e.type === "proposal") {
        await repo.createProject({
          runId: run.id, niche: e.niche, budgetCents,
          projectedNetCents: Math.round(e.economics.net * 100),
          marginPct: e.economics.marginPct, riskScore: e.riskScore,
        });
      }
      if (e.type === "end") verdict = e.verdict;
    }
    await repo.finishRun(run.id, verdict);
    if (verdict !== "SHIP") await repo.release(run.id); // KILL refunds to the original source
    return reply.code(201).send(await repo.getRun(run.id));
  });

  app.get<{ Params: { id: string } }>("/runs/:id", async (req) => repo.getRun(req.params.id));

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/runs/:id/events", async (req) =>
    repo.listEvents(req.params.id, Number(req.query.after ?? 0) || 0));

  app.get("/proposals", async () => repo.listProposals());

  for (const [path, action] of [["approve", "APPROVED"], ["reject", "REJECTED"]] as const) {
    app.post<{ Params: { id: string } }>(`/proposals/:id/${path}`, async (req) => {
      const { decidedBy } = DecisionBody.parse(req.body);
      return repo.decide(req.params.id, action, decidedBy);
    });
  }

  app.get("/ledger", async () => repo.ledger());
  app.get("/approvals", async () => repo.approvals());

  return app;
}
