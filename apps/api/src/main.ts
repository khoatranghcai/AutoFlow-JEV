import { buildServer } from "./server";
import { createMemoryRepo } from "./repo";

// Local dev only: in-memory storage with demo capital. A Supabase-backed Repo replaces this.
const repo = createMemoryRepo();
await repo.deposit("liquid", 420_000);
await repo.deposit("pool", 118_000);

const app = buildServer({ repo });
await app.listen({ port: Number(process.env.PORT ?? 8787), host: "127.0.0.1" });
