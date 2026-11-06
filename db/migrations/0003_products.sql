-- Reviewable products produced by the Builder. Approving a product only marks it ready to list; it never moves money
-- and never publishes anything. Listing on a marketplace is a separate, later step.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('prompt_pack')),
  niche text not null,
  title text not null,
  price_cents integer not null check (price_cents >= 0),
  qc_score integer not null,
  content jsonb not null,
  markdown text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security; -- no policies: only the service role (API) can touch it
