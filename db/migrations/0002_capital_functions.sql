-- Atomic capital operations. Each function takes a global advisory lock so concurrent
-- calls serialize, and derives everything from the append-only ledger.
-- Reservation sources are remembered per run, so a refund always returns to the same buckets.

alter table capital_ledger add column run_id uuid references runs(id);
create index ledger_run_idx on capital_ledger (run_id);

create function capital_balance(p_bucket text) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.capital_ledger where bucket = p_bucket
$$;

-- Reserve a test budget: pool first, then liquid. Raises insufficient_capital.
create function reserve_for_run(p_run uuid, p_cents bigint) returns void
language plpgsql set search_path = '' as $$
declare
  v_pool bigint; v_liquid bigint; v_from_pool bigint; v_from_liquid bigint;
begin
  perform pg_advisory_xact_lock(hashtext('autoflow_capital'));
  if p_cents < 0 then raise exception 'invalid_amount'; end if;
  if exists (select 1 from public.capital_ledger where run_id = p_run and kind = 'reserve') then
    raise exception 'already_reserved';
  end if;
  v_pool := public.capital_balance('pool');
  v_liquid := public.capital_balance('liquid');
  if p_cents > v_pool + v_liquid then raise exception 'insufficient_capital'; end if;
  v_from_pool := least(v_pool, p_cents);
  v_from_liquid := p_cents - v_from_pool;
  insert into public.capital_ledger (run_id, kind, bucket, amount_cents) values
    (p_run, 'reserve', 'pool', -v_from_pool),
    (p_run, 'reserve', 'liquid', -v_from_liquid),
    (p_run, 'reserve', 'reserved', p_cents);
end $$;

-- KILL or abort: give the reservation back to its sources. Calling it twice does nothing.
create function release_run(p_run uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('autoflow_capital'));
  if not exists (select 1 from public.capital_ledger where run_id = p_run and kind = 'reserve') then return; end if;
  if exists (select 1 from public.capital_ledger where run_id = p_run and kind in ('refund','settle_profit','settle_loss')) then return; end if;
  insert into public.capital_ledger (run_id, kind, bucket, amount_cents)
    select p_run, 'refund', bucket, -amount_cents from public.capital_ledger where run_id = p_run and kind = 'reserve';
end $$;

-- Record a human decision exactly once and move the money. Raises not_found / conflict.
-- Approval settles with the projected net: profit splits 80% to the pool, the rest to liquid;
-- a loss comes out of liquid.
create function decide_proposal(p_project uuid, p_action approval_action, p_by text, p_rules text default null)
returns public.approvals
language plpgsql set search_path = '' as $$
declare
  p public.projects; v_run uuid; v_to_pool bigint; r public.approvals;
begin
  perform pg_advisory_xact_lock(hashtext('autoflow_capital'));
  if p_by is null or length(trim(p_by)) = 0 then raise exception 'approver_required'; end if;
  select * into p from public.projects where id = p_project for update;
  if not found then raise exception 'not_found'; end if;
  if p.status <> 'proposed' then raise exception 'conflict'; end if;
  v_run := p.run_id;
  if not exists (select 1 from public.capital_ledger where run_id = v_run and kind = 'reserve')
     or exists (select 1 from public.capital_ledger where run_id = v_run and kind in ('refund','settle_profit','settle_loss')) then
    raise exception 'conflict';
  end if;

  if p_action = 'APPROVED' then
    insert into public.capital_ledger (run_id, project_id, kind, bucket, amount_cents)
      select v_run, p.id, case when p.projected_net_cents >= 0 then 'settle_profit' else 'settle_loss' end::public.ledger_kind, bucket, -amount_cents
      from public.capital_ledger where run_id = v_run and kind = 'reserve';
    if p.projected_net_cents >= 0 then
      v_to_pool := round(p.projected_net_cents * 0.8);
      insert into public.capital_ledger (run_id, project_id, kind, bucket, amount_cents) values
        (v_run, p.id, 'settle_profit', 'pool', v_to_pool),
        (v_run, p.id, 'settle_profit', 'liquid', p.projected_net_cents - v_to_pool);
    else
      insert into public.capital_ledger (run_id, project_id, kind, bucket, amount_cents)
        values (v_run, p.id, 'settle_loss', 'liquid', p.projected_net_cents);
    end if;
    update public.projects set status = 'approved' where id = p.id;
  else
    insert into public.capital_ledger (run_id, project_id, kind, bucket, amount_cents)
      select v_run, p.id, 'refund', bucket, -amount_cents from public.capital_ledger where run_id = v_run and kind = 'reserve';
    update public.projects set status = 'rejected' where id = p.id;
  end if;

  insert into public.approvals (project_id, action, decided_by, rules_version)
    values (p.id, p_action, trim(p_by), p_rules) returning * into r;
  return r;
end $$;

-- Only the service role may call these.
revoke execute on function capital_balance(text), reserve_for_run(uuid, bigint), release_run(uuid),
  decide_proposal(uuid, approval_action, text, text) from public, anon, authenticated;
