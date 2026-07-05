-- Fountain DAM schema. Applied live to Supabase project gfsdpwiqzshhexkofiif
-- 2026-07-05. Additive: a dedicated `dam` schema, zero impact on public/ops/orders.
--
-- After creating the schema, `dam` was added to PostgREST's exposed schemas:
--   alter role authenticator set pgrst.db_schemas = 'public, graphql_public, ops, orders, dam';
--   notify pgrst, 'reload config';
-- RLS is enabled with NO permissive policies, so only the service-role Netlify
-- functions (which bypass RLS) can read/write dam — anon/authenticated direct
-- REST access returns nothing.

create schema if not exists dam;

create table if not exists dam.assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  filename text, title text, description text,
  type text not null default 'other',
  brand text not null default 'shared',
  status text not null default 'approved',
  width int, height int, bytes bigint,
  content_type text, dominant_color text,
  version int not null default 1,
  uploaded_by uuid, uploaded_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table dam.assets add column if not exists search tsvector
  generated always as (to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(filename,'') || ' ' || coalesce(description,'') || ' ' || coalesce(type,'') || ' ' || coalesce(brand,''))) stored;

create table if not exists dam.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists dam.asset_tags (
  asset_id uuid not null references dam.assets(id) on delete cascade,
  tag_id uuid not null references dam.tags(id) on delete cascade,
  primary key (asset_id, tag_id)
);
create table if not exists dam.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique, description text,
  cover_asset_id uuid references dam.assets(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists dam.collection_assets (
  collection_id uuid not null references dam.collections(id) on delete cascade,
  asset_id uuid not null references dam.assets(id) on delete cascade,
  sort_order int not null default 0,
  added_at timestamptz not null default now(),
  primary key (collection_id, asset_id)
);
create table if not exists dam.shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique, kind text not null,
  asset_id uuid references dam.assets(id) on delete cascade,
  collection_id uuid references dam.collections(id) on delete cascade,
  title text, allow_download boolean not null default true,
  password_hash text, expires_at timestamptz,
  view_count int not null default 0,
  created_by uuid, created_by_email text,
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);
create table if not exists dam.share_events (
  id bigint generated always as identity primary key,
  share_id uuid not null references dam.shares(id) on delete cascade,
  event text not null, asset_id uuid, ip text, ua text,
  created_at timestamptz not null default now()
);
create table if not exists dam.members (
  user_id uuid primary key, email text,
  role text not null default 'viewer',
  invited_by uuid, created_at timestamptz not null default now()
);

create index if not exists assets_type_idx on dam.assets (type);
create index if not exists assets_brand_idx on dam.assets (brand);
create index if not exists assets_status_idx on dam.assets (status);
create index if not exists assets_search_idx on dam.assets using gin (search);
create index if not exists asset_tags_tag_idx on dam.asset_tags (tag_id);
create index if not exists collection_assets_asset_idx on dam.collection_assets (asset_id);
create index if not exists share_events_share_idx on dam.share_events (share_id);

grant usage on schema dam to service_role;
grant all on all tables in schema dam to service_role;

alter table dam.assets enable row level security;
alter table dam.tags enable row level security;
alter table dam.asset_tags enable row level security;
alter table dam.collections enable row level security;
alter table dam.collection_assets enable row level security;
alter table dam.shares enable row level security;
alter table dam.share_events enable row level security;
alter table dam.members enable row level security;
