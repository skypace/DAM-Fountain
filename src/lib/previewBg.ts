import { useEffect, useState } from 'react';

// Viewing background for image/preview areas. White/transparent logos vanish on
// a white tile, so the operator can pick a backdrop:
//   light  – white
//   dark   – navy
//   none   – transparent (inherits the surface)
//   diecut – transparency checkerboard (see the cutout / die-cut shape)
export type PreviewBg = 'light' | 'dark' | 'none' | 'diecut';
export const PREVIEW_BGS: PreviewBg[] = ['light', 'dark', 'none', 'diecut'];
export const PREVIEW_BG_LABEL: Record<PreviewBg, string> = {
  light: 'White', dark: 'Dark', none: 'None', diecut: 'Die cut',
};

const KEY = 'fountain_preview_bg';
const OVR_KEY = 'fountain_bg_overrides';
const EVT = 'fountain:previewbg';

function norm(v: unknown): PreviewBg {
  return v === 'dark' || v === 'none' || v === 'diecut' || v === 'light' ? v : 'light';
}

export function getPreviewBg(): PreviewBg {
  return norm(typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null);
}
export function setPreviewBg(v: PreviewBg) {
  localStorage.setItem(KEY, v);
  window.dispatchEvent(new CustomEvent(EVT));
}

// Per-item (folder/asset) background overrides, keyed by id.
function readOverrides(): Record<string, PreviewBg> {
  try { return JSON.parse(localStorage.getItem(OVR_KEY) || '{}'); } catch { return {}; }
}
export function getItemBg(id: string): PreviewBg | null {
  const v = readOverrides()[id];
  return v ? norm(v) : null;
}
export function setItemBg(id: string, v: PreviewBg | null) {
  const all = readOverrides();
  if (v) all[id] = v; else delete all[id];
  localStorage.setItem(OVR_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function previewBgSx(mode: PreviewBg) {
  if (mode === 'dark') return { bgcolor: '#0f172a' };
  if (mode === 'none') return { bgcolor: 'transparent' };
  if (mode === 'diecut') {
    return {
      backgroundColor: '#fff',
      backgroundImage:
        'linear-gradient(45deg,#dbe2ea 25%,transparent 25%),linear-gradient(-45deg,#dbe2ea 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#dbe2ea 75%),linear-gradient(-45deg,transparent 75%,#dbe2ea 75%)',
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
    };
  }
  return { bgcolor: '#fff' };
}

// Global preview background + a live-updating per-item resolver. `bgFor(id)`
// returns the item's override if set, else the global default.
export function usePreviewBg(): [PreviewBg, (v: PreviewBg) => void, (id?: string | null) => PreviewBg] {
  const [mode, setMode] = useState<PreviewBg>(getPreviewBg);
  const [, bump] = useState(0);
  useEffect(() => {
    const onEvt = () => { setMode(getPreviewBg()); bump((n) => n + 1); };
    const onStorage = () => onEvt();
    window.addEventListener(EVT, onEvt);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(EVT, onEvt); window.removeEventListener('storage', onStorage); };
  }, []);
  const bgFor = (id?: string | null) => (id && getItemBg(id)) || mode;
  return [mode, setPreviewBg, bgFor];
}
