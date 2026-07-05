import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { DEFAULT_BRANDS, type BrandInfo } from './types';

// Shared loader for the dynamic brand registry (dam.brands). Falls back to the
// built-in Alameda / Brix / Shared trio if the request fails so the UI never
// renders an empty brand picker.
export function useBrands() {
  const [brands, setBrands] = useState<BrandInfo[]>(DEFAULT_BRANDS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const b = await api.listBrands();
      if (b?.length) setBrands(b);
    } catch { /* keep defaults */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const labelOf = useCallback(
    (slug: string) => brands.find((b) => b.slug === slug)?.label || slug,
    [brands],
  );

  return { brands, loading, reload, labelOf };
}
