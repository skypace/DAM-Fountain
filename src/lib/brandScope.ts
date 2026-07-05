import { useEffect, useState } from 'react';

// Which brand the operator is "in" — a global scope set from the sidebar. 'all'
// means no scoping. Persisted in localStorage and broadcast so every view reacts.
const KEY = 'fountain_brand_scope';
const EVT = 'fountain:brandscope';

export function getBrandScope(): string {
  return (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || 'all';
}
export function setBrandScope(v: string) {
  localStorage.setItem(KEY, v || 'all');
  window.dispatchEvent(new CustomEvent(EVT, { detail: v || 'all' }));
}

export function useBrandScope(): [string, (v: string) => void] {
  const [scope, setScope] = useState<string>(getBrandScope);
  useEffect(() => {
    const onEvt = (e: Event) => setScope((e as CustomEvent).detail as string);
    const onStorage = () => setScope(getBrandScope());
    window.addEventListener(EVT, onEvt);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(EVT, onEvt); window.removeEventListener('storage', onStorage); };
  }, []);
  return [scope, setBrandScope];
}
