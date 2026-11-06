import { buildServer } from "./server";
import { createMemoryRepo } from "./repo";
import { createSupabaseRepoFromEnv } from "./supabaseRepo";

// With SUPABASE_URL set, use Postgres (capital rules enforced in the DB). Otherwise local dev:
// in-memory storage with demo capital.
const useDb = Boolean(process.env.SUPABASE_URL);
const repo = useDb ? createSupabaseRepoFromEnv() : createMemoryRepo();
if (!useDb) {
  await repo.deposit("liquid", 420_000);
  await repo.deposit("pool", 118_000);
}

const app = buildServer({ repo });
await app.listen({ port: Number(process.env.PORT ?? 8787), host: "127.0.0.1" });
