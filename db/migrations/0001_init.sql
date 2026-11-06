-- AutoFlow JEV initial schema. Money is stored as integer cents. The API uses the
-- service role; RLS is enabled with no policies so anon/authenticated roles see nothing.

create type run_status as enum ('running','paused','ended','aborted');
create type verdict_kind as enum ('KILL','FIX','SHIP');
create type project_status as enum ('proposed','approved','rejected','launched','settled','killed');
create type ledger_kind as enum ('deposit','reserve','refund','settle_profit','settle_loss','adjustment');
create type approval_action as enum ('APPROVED','REJECTED');

create table runs (
  id uuid primary key default gen_random_uuid(),
  niche text not null,
  tolerance text not null check (tolerance in ('LOW','MED','HIGH')),
  max_budget_cents bigint not null check (max_budget_cents >= 0),
  seed bigint,
  mode text not null default 'sim' check (mode in ('sim','live')),
  status run_status not null default 'running',
  verdict verdict_kind,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table events (
  id bigint generated always as identity primary key,
  run_id uuid not null references runs(id) on delete cascade,
  seq int not null,
  type text not null,
  level text not null default 'info' check (level in ('info','success','warn','error')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (run_id, seq)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references runs(id),
  niche text not null,
  status project_status not null default 'proposed',
  budget_cents bigint not null check (budget_cents >= 0),
  margin_pct numeric(6,2),
  risk_score int,
  projected_net_cents bigint,
  created_at timestamptz not null default now()
);

-- Append-only: balances are always derived from this table.
create table capital_ledger (
  id bigint generated always as identity primary key,
  project_id uuid references projects(id),
  kind ledger_kind not null,
  bucket text not null check (bucket in ('liquid','pool','reserved')),
  amount_cents bigint not null,
  note text,
  created_at timestamptz not null default now()
);

-- Append-only record of every human decision.
create table approvals (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects(id),
  action approval_action not null,
  decided_by text not null,
  rules_version text,
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create function forbid_change() returns trigger language plpgsql set search_path = '' as $$
begin raise exception '% is append-only', tg_table_name; end $$;

create trigger capital_ledger_append_only before update or delete on capital_ledger
  for each row execute function forbid_change();
create trigger approvals_append_only before update or delete on approvals
  for each row execute function forbid_change();

create view capital_balances with (security_invoker = true) as
  select bucket, coalesce(sum(amount_cents),0)::bigint as cents from capital_ledger group by bucket;

alter table runs enable row level security;
alter table events enable row level security;
alter table projects enable row level security;
alter table capital_ledger enable row level security;
alter table approvals enable row level security;
alter table settings enable row level security;

create index events_run_idx on events (run_id, seq);
create index ledger_project_idx on capital_ledger (project_id);
create index approvals_project_idx on approvals (project_id);
