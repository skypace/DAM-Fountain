import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { DEFAULT_TYPES, type TypeInfo } from './types';

// Shared loader for the dynamic asset-type registry (dam.asset_types). Falls
// back to the built-in set if the request fails. `addType` prompts + creates.
export function useTypes() {
  const [types, setTypes] = useState<TypeInfo[]>(DEFAULT_TYPES);

  const reload = useCallback(async () => {
    try { const t = await api.listTypes(); if (t?.length) setTypes(t); } catch { /* keep defaults */ }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const labelOf = useCallback((slug: string) => types.find((t) => t.slug === slug)?.label || slug, [types]);

  // Prompt for a new type, create it, refresh, and return its slug (or null).
  const addType = useCallback(async (): Promise<string | null> => {
    const label = window.prompt('New asset type (e.g. "Vehicle Wrap", "Menu Board")');
    if (!label || !label.trim()) return null;
    const t = await api.createType(label.trim());
    await reload();
    return t.slug;
  }, [reload]);

  return { types, reload, labelOf, addType };
}
