import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Dialog, InputAdornment, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { Search, FolderOpen, FileImage } from 'lucide-react';
import { api } from '../lib/api';
import type { Asset, Collection } from '../lib/types';

// ⌘K / Ctrl+K global search palette. Searches assets + collections and jumps.
export function CommandPalette() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cols, setCols] = useState<Collection[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) { setQ(''); setCols([]); setAssets([]); return; }
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setCols([]); setAssets([]); return; }
    const id = setTimeout(async () => {
      try {
        const [all, a] = await Promise.all([api.listCollections(), api.listAssets({ q: term })]);
        setCols(all.filter((c) => c.name.toLowerCase().includes(term.toLowerCase())).slice(0, 6));
        setAssets(a.slice(0, 8));
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  const go = (path: string) => { setOpen(false); nav(path); };
  const hasResults = useMemo(() => cols.length || assets.length, [cols, assets]);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { position: 'fixed', top: 80, m: 0 } }}>
      <Box sx={{ p: 1.5 }}>
        <TextField
          inputRef={inputRef} fullWidth size="medium" placeholder="Search assets and folders…" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) go(`/?q=${encodeURIComponent(q.trim())}`); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }}
        />
      </Box>
      {q.trim() && (
        <List dense sx={{ pt: 0, maxHeight: 420, overflowY: 'auto' }}>
          {cols.length > 0 && <Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>Folders</Typography>}
          {cols.map((c) => (
            <ListItemButton key={c.id} onClick={() => go(`/collections/${c.id}`)}>
              <FolderOpen size={16} style={{ marginRight: 10, opacity: 0.6 }} />
              <ListItemText primary={c.name} secondary={`${c.count ?? 0} assets`} />
            </ListItemButton>
          ))}
          {assets.length > 0 && <Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>Assets</Typography>}
          {assets.map((a) => (
            <ListItemButton key={a.id} onClick={() => go(`/?q=${encodeURIComponent(a.title || a.filename || '')}`)}>
              <FileImage size={16} style={{ marginRight: 10, opacity: 0.6 }} />
              <ListItemText primary={a.title || a.filename} secondary={a.type} />
            </ListItemButton>
          ))}
          {!hasResults && <Box sx={{ px: 2, py: 2 }}><Typography variant="body2" color="text.secondary">No matches. Press Enter to search the library.</Typography></Box>}
        </List>
      )}
      {!q.trim() && (
        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2, color: 'text.secondary' }}>
          <Typography variant="caption">Type to search · Enter for full results · Esc to close</Typography>
        </Stack>
      )}
    </Dialog>
  );
}
