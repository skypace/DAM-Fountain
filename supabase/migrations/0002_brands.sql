-- Fountain DAM: dynamic brand registry so sister brands can be added beyond the
-- built-in Alameda Soda / Brix / Shared. Applied live to gfsdpwiqzshhexkofiif
-- 2026-07-05. `dam.assets.brand` and `dam.brand_guidelines.brand` remain plain
-- text keyed on the slug here; the app validates a slug shape rather than a fixed
-- enum, and the brand picker + guidelines tabs are populated from this table.
create table if not exists dam.brands (
  slug text primary key,
  label text not null,
  is_sister boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

insert into dam.brands (slug, label, is_sister, sort_order) values
  ('alameda', 'Alameda Soda', false, 10),
  ('brix',    'Brix Beverage', false, 20),
  ('shared',  'Shared', false, 30)
on conflict (slug) do nothing;

grant all on dam.brands to service_role;
alter table dam.brands enable row level security;
