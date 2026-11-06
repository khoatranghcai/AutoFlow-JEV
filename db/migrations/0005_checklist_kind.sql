alter table public.products drop constraint if exists products_kind_check;
alter table public.products add constraint products_kind_check check (kind in ('prompt_pack','sheet_template','checklist'));
