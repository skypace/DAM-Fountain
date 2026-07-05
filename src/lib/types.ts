export type AssetType = 'logo' | 'can' | 'equipment' | 'hero' | 'testimonial' | 'sell-sheet' | 'other';
// Brands are dynamic (managed in dam.brands) so sister brands can be added — the
// slug is just a string. The built-in trio below is the fallback / seed.
export type Brand = string;
export type AssetStatus = 'draft' | 'approved' | 'archived';
export type Role = 'viewer' | 'contributor' | 'admin';

export interface BrandInfo { slug: string; label: string; is_sister: boolean; sort_order: number }

export const ASSET_TYPES: AssetType[] = ['logo', 'can', 'equipment', 'hero', 'testimonial', 'sell-sheet', 'other'];
export const BRANDS: string[] = ['alameda', 'brix', 'shared'];
export const DEFAULT_BRANDS: BrandInfo[] = [
  { slug: 'alameda', label: 'Alameda Soda', is_sister: false, sort_order: 10 },
  { slug: 'brix', label: 'Brix Beverage', is_sister: false, sort_order: 20 },
  { slug: 'shared', label: 'Shared', is_sister: false, sort_order: 30 },
];
export const STATUSES: AssetStatus[] = ['draft', 'approved', 'archived'];

export interface Tag { id: string; name: string; count?: number }

export interface Asset {
  id: string;
  storage_path: string;
  filename: string | null;
  title: string | null;
  description: string | null;
  type: AssetType;
  brand: Brand;
  status: AssetStatus;
  bytes: number | null;
  content_type: string | null;
  version: number;
  uploaded_by_email: string | null;
  created_at: string;
  updated_at: string;
  url: string;
  thumbnailUrl: string | null;
  tags: Tag[];
  collections: { id: string; name: string }[];
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id?: string | null;
  cover_asset_id: string | null;
  coverUrl?: string | null;
  cover?: { url: string; filename: string | null; content_type: string | null } | null;
  count?: number;
  subfolderCount?: number;
  created_at: string;
}

export interface Share {
  id: string;
  token: string;
  kind: 'asset' | 'collection';
  asset_id: string | null;
  collection_id: string | null;
  title: string | null;
  allow_download: boolean;
  has_password: boolean;
  expires_at: string | null;
  view_count: number;
  revoked: boolean;
  created_by_email: string | null;
  created_at: string;
  collection?: { name: string } | null;
  asset?: { title: string | null; storage_path: string } | null;
}

export interface Member { user_id: string; email: string | null; role: Role; created_at: string }

export interface GuidelineFile { name: string; path?: string; contentType?: string; url?: string }
export interface GuidelineFont { name: string; note?: string; path?: string; url?: string; format?: string }
export type BrandKey = string;
export interface BrandGuidelines {
  colors: { name: string; hex: string }[];
  fonts: GuidelineFont[];
  sections: { title: string; body: string }[];
  files: GuidelineFile[];
}

export interface AssetVersion {
  id: string;
  version: number;
  filename: string | null;
  bytes: number | null;
  created_at: string;
  created_by_email: string | null;
  url: string;
  thumbnailUrl: string | null;
}
