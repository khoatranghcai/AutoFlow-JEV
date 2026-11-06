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

## Chạy local

Cần Node >= 20.12 và pnpm (`npm i -g pnpm`).

```
git clone https://github.com/khoatranghcai/AutoFlow-JEV
cd AutoFlow-JEV
pnpm install
```

**API** (cổng 8787):

```
cp apps/api/.env.example apps/api/.env      # Windows: copy apps\api\.env.example apps\api\.env
# mở apps/api/.env, điền SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY (xem dưới)
pnpm --filter @autoflow/api start
```

Để trống hai biến thì API chạy với dữ liệu demo trong bộ nhớ (không dùng Supabase).
Kiểm tra: mở http://127.0.0.1:8787/health, và http://127.0.0.1:8787/capital để xem số dư.

**Web dashboard** (cổng 5173, hiện chạy độc lập bằng pipeline mô phỏng):

```
pnpm --filter @autoflow/web dev
```

Chế độ live (web dùng API, cần API đang chạy): `pnpm --filter @autoflow/web dev:live`. Nhãn cạnh tiêu đề hiện `LIVE (staging)` khi API dùng Supabase.

**Lấy khóa Supabase**: Supabase Dashboard > chọn project `autoflow-jev-staging` > Project Settings > API.
`SUPABASE_URL` là *Project URL*; `SUPABASE_SERVICE_ROLE_KEY` là khóa `service_role` (secret) ở mục API Keys.
Khóa này toàn quyền: chỉ để trong `apps/api/.env` (đã được `.gitignore` chặn), không commit, không dán vào chat.

**Gợi ý niche bằng AI (tùy chọn)**: điền `ANTHROPIC_API_KEY` trong `apps/api/.env` (tạo khóa tại console.anthropic.com, mục API keys). API dùng Claude kèm tìm kiếm web để gợi ý niche theo xu hướng, có giới hạn tần suất (`NICHE_MIN_INTERVAL_SEC`), số lần mỗi ngày (`NICHE_MAX_CALLS_PER_DAY`) và ngân sách ước tính mỗi ngày (`NICHE_DAILY_BUDGET_USD`). Không có khóa hoặc gặp lỗi/giới hạn thì tự dùng kho có sẵn.
