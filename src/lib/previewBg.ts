import { useEffect, useState } from 'react';

// Viewing background for image/preview areas. White/transparent logos vanish on
// a white tile, so the user can pick a light or dark (or checkerboard) backdrop.
export type PreviewBg = 'light' | 'dark' | 'checker';
const KEY = 'fountain_preview_bg';
const EVT = 'fountain:previewbg';

export function getPreviewBg(): PreviewBg {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) as PreviewBg | null;
  return v === 'dark' || v === 'checker' || v === 'light' ? v : 'light';
}
export function setPreviewBg(v: PreviewBg) {
  localStorage.setItem(KEY, v);
  window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
}

// sx background for a preview surface given the chosen mode.
export function previewBgSx(mode: PreviewBg) {
  if (mode === 'dark') return { bgcolor: '#0f172a' };
  if (mode === 'checker') {
    return {
      backgroundColor: '#fff',
      backgroundImage:
        'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
    };
  }
  return { bgcolor: '#fff' };
}

export function usePreviewBg(): [PreviewBg, (v: PreviewBg) => void] {
  const [mode, setMode] = useState<PreviewBg>(getPreviewBg);
  useEffect(() => {
    const onEvt = (e: Event) => setMode((e as CustomEvent).detail as PreviewBg);
    const onStorage = () => setMode(getPreviewBg());
    window.addEventListener(EVT, onEvt);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(EVT, onEvt); window.removeEventListener('storage', onStorage); };
  }, []);
  return [mode, setPreviewBg];
}
