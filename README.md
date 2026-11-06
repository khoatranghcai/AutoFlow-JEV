# AutoFlow JEV Swarm Engine

Job → Executor → Validator pipeline with a 3-verdict engine (KILL / FIX / SHIP) and a human approval gate.
Monorepo (pnpm). See the planning doc for architecture and phases.

- `packages/config`: business rules (single source of truth)
- `packages/engine`: pipeline engine (seeded RNG so far)
- `packages/i18n`: EN/VI dictionaries with parity tests

```
pnpm install
pnpm typecheck && pnpm test
```
