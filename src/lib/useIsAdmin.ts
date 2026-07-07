import { useEffect, useState } from 'react';
import { api } from './api';

// Resolves whether the signed-in user is a DAM admin (server-authoritative via
// /whoami). null = still loading. Used to gate admin-only UI like the API page.
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    api.whoami()
      .then((r) => { if (live) setIsAdmin(!!r.isAdmin); })
      .catch(() => { if (live) setIsAdmin(false); });
    return () => { live = false; };
  }, []);
  return isAdmin;
}
