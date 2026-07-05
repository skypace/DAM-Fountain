-- Fountain DAM: nested collections (sub-folders). A collection may have a parent
-- collection; top-level collections have parent_id = null. Applied live to
-- gfsdpwiqzshhexkofiif 2026-07-05. Deleting a folder cascades to its sub-folders
-- (assets themselves are never deleted — only the collection_assets links go).
alter table dam.collections
  add column if not exists parent_id uuid references dam.collections(id) on delete cascade;

create index if not exists collections_parent_idx on dam.collections (parent_id);
