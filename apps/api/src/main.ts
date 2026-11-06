import { buildServer } from "./server";
import { createMemoryRepo } from "./repo";
import { createSupabaseRepoFromEnv } from "./supabaseRepo";
import { createNicheServiceFromEnv } from "./nicheAi";

// Load apps/api/.env when present (Node >= 20.12); real environment variables still win.
try { process.loadEnvFile(new URL("../.env", import.meta.url)); } catch { /* no .env file */ }

// With SUPABASE_URL set, use Postgres (capital rules enforced in the DB). Otherwise local dev:
// in-memory storage with demo capital.
const useDb = Boolean(process.env.SUPABASE_URL);
const repo = useDb ? createSupabaseRepoFromEnv() : createMemoryRepo();
if (!useDb) {
  await repo.deposit("liquid", 420_000);
  await repo.deposit("pool", 118_000);
}

const backend = useDb ? "supabase" : "in-memory";
const app = buildServer({ repo, backend, niches: createNicheServiceFromEnv() });
await app.listen({ port: Number(process.env.PORT ?? 8787), host: "127.0.0.1" });
console.log(`AutoFlow API listening on :${process.env.PORT ?? 8787} using ${backend} storage; niche suggestions: ${process.env.ANTHROPIC_API_KEY ? "Claude" : "static catalog (no ANTHROPIC_API_KEY)"}`);
