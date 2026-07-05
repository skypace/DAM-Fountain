-- Fountain DAM: dynamic asset-type registry so new types can be added when the
-- built-in set doesn't fit. Applied live to gfsdpwiqzshhexkofiif 2026-07-05.
-- dam.assets.type stays plain text keyed on the slug here; the app validates a
-- slug shape rather than a fixed enum, and the type pickers read this table.
create table if not exists dam.asset_types (
  slug text primary key,
  label text not null,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

insert into dam.asset_types (slug, label, sort_order) values
  ('logo','Logo',10),
  ('can','Can / Package',20),
  ('equipment','Equipment',30),
  ('hero','Hero / Lifestyle',40),
  ('testimonial','Testimonial',50),
  ('sell-sheet','Sell Sheet',60),
  ('other','Other',900)
on conflict (slug) do nothing;

grant all on dam.asset_types to service_role;
alter table dam.asset_types enable row level security;
