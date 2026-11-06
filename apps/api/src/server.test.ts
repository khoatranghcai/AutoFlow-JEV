import { beforeEach, describe, expect, test } from "vitest";
import { buildServer } from "./server";
import { createMemoryRepo, type Repo } from "./repo";

let repo: Repo;
let app: ReturnType<typeof buildServer>;
const total = (c: { liquid: number; pool: number; reserved: number }) => c.liquid + c.pool + c.reserved;

beforeEach(async () => {
  repo = createMemoryRepo();
  await repo.deposit("liquid", 100_000);
  await repo.deposit("pool", 10_000);
  app = buildServer({ repo });
});

const post = (url: string, payload: unknown) => app.inject({ method: "POST", url, payload: payload as object });

/** Try seeds until a run ships; the simulation is deterministic per seed. */
async function shippedRun() {
  for (let seed = 1; seed < 400; seed++) {
    const res = await post("/runs", { niche: "n", tolerance: "HIGH", maxBudgetUsd: 30, seed });
    if (res.json().verdict === "SHIP") return res.json();
  }
  throw new Error("no SHIP seed found");
}

describe("runs", () => {
  test("validates input", async () => {
    expect((await post("/runs", { niche: "", maxBudgetUsd: 1 })).statusCode).toBe(400);
    expect((await post("/runs", { niche: "x", maxBudgetUsd: -5 })).statusCode).toBe(400);
  });
  test("refuses budgets over the hard cap before reserving anything", async () => {
    const res = await post("/runs", { niche: "x", maxBudgetUsd: 51 });
    expect(res.statusCode).toBe(422);
    expect(await repo.balances()).toEqual({ liquid: 100_000, pool: 10_000, reserved: 0 });
  });
  test("refuses when there is not enough free capital", async () => {
    const small = buildServer({ repo: createMemoryRepo(), maxRunBudgetCents: 1_000_000 });
    const res = await small.inject({ method: "POST", url: "/runs", payload: { niche: "x", maxBudgetUsd: 10 } });
    expect(res.statusCode).toBe(409);
  });
  test("a KILL gives the whole reservation back", async () => {
    let checked = false;
    for (let seed = 1; seed < 100 && !checked; seed++) {
      const before = await repo.balances();
      const res = await post("/runs", { niche: "x", tolerance: "LOW", maxBudgetUsd: 30, seed });
      if (res.json().verdict === "KILL") {
        expect(await repo.balances()).toEqual(before); // reserve then refund to the same sources
        checked = true;
      }
    }
    expect(checked).toBe(true);
  });
  test("events are stored and can be read back in order", async () => {
    const run = (await post("/runs", { niche: "x", maxBudgetUsd: 10, seed: 5 })).json();
    const ev = (await app.inject({ url: `/runs/${run.id}/events` })).json() as { seq: number; event: { type: string } }[];
    expect(ev[0]?.event.type).toBe("phase");
    expect(ev.map((e) => e.seq)).toEqual(ev.map((_, i) => i + 1));
    expect(ev[ev.length - 1]?.event.type).toBe("end");
  });
});

describe("human approval", () => {
  test("a SHIP only creates a proposal and keeps the budget reserved", async () => {
    await shippedRun();
    expect((await app.inject({ url: "/proposals" })).json()).toHaveLength(1);
    expect((await repo.balances()).reserved).toBe(3_000);
  });
  test("approve needs a named approver and settles once", async () => {
    await shippedRun();
    const [p] = (await app.inject({ url: "/proposals" })).json() as { id: string; projectedNetCents: number }[];
    expect((await post(`/proposals/${p!.id}/approve`, {})).statusCode).toBe(400);
    const before = await repo.balances();
    const ok = await post(`/proposals/${p!.id}/approve`, { decidedBy: "khoa" });
    expect(ok.statusCode).toBe(200);
    const after = await repo.balances();
    expect(after.reserved).toBe(0);
    expect(total(after)).toBe(total(before) + p!.projectedNetCents);
    expect((await post(`/proposals/${p!.id}/approve`, { decidedBy: "khoa" })).statusCode).toBe(409);
    expect((await post(`/proposals/${p!.id}/reject`, { decidedBy: "khoa" })).statusCode).toBe(409);
    expect(await repo.approvals()).toHaveLength(1);
  });
  test("reject refunds and conserves total capital", async () => {
    await shippedRun();
    const [p] = (await app.inject({ url: "/proposals" })).json() as { id: string }[];
    await post(`/proposals/${p!.id}/reject`, { decidedBy: "khoa" });
    const c = await repo.balances();
    expect(c.reserved).toBe(0);
    expect(total(c)).toBe(110_000);
    expect((await app.inject({ url: "/proposals" })).json()).toHaveLength(0);
  });
  test("unknown proposal is 404", async () => {
    expect((await post("/proposals/nope/approve", { decidedBy: "x" })).statusCode).toBe(404);
  });
});
