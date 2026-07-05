import { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { mediaKind, MEDIA_META } from '../lib/media';

const isPdf = (url: string, filename?: string | null, ct?: string | null) =>
  /\.pdf(\?|#|$)/i.test(url) || /\.pdf$/i.test(filename || '') || ct === 'application/pdf';
const isHeic = (url: string, filename?: string | null, ct?: string | null) =>
  /\.hei[cf](\?|#|$)/i.test(url) || /\.hei[cf]$/i.test(filename || '') || /image\/hei[cf]/i.test(ct || '');

// Browsers (except Safari) can't decode HEIC/HEIF, so convert to a JPEG object
// URL on the fly via heic2any (lazy-loaded wasm). Results are cached per source
// URL so a grid of HEICs only converts each once.
const heicCache = new Map<string, Promise<string>>();
async function convertHeic(url: string): Promise<string> {
  if (heicCache.has(url)) return heicCache.get(url)!;
  const p = (async () => {
    const res = await fetch(url);
    const blob = await res.blob();
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 });
    return URL.createObjectURL(Array.isArray(out) ? out[0] : out);
  })();
  heicCache.set(url, p);
  p.catch(() => heicCache.delete(url)); // let a failed convert retry later
  return p;
}

function HeicImage({ url, alt }: { url: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setSrc(null); setFailed(false);
    convertHeic(url).then((u) => { if (live) setSrc(u); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [url]);
  if (failed) {
    return (
      <Stack alignItems="center" spacing={0.5} sx={{ color: MEDIA_META.image.color }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>HEIC</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>preview unavailable</Typography>
      </Stack>
    );
  }
  if (!src) return <CircularProgress size={20} />;
  return <Box component="img" src={src} alt={alt || ''} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}

// Renders an actual preview of an asset — image, video frame/player, or embedded
// PDF page — falling back to a kind icon only for audio/design/other.
export function MediaPreview({ url, filename, contentType, variant, alt }: {
  url: string;
  filename?: string | null;
  contentType?: string | null;
  variant: 'thumb' | 'full';
  alt?: string;
}) {
  const kind = mediaKind(contentType, filename);
  const full = variant === 'full';
  const Icon = MEDIA_META[kind].icon;

  if (isHeic(url, filename, contentType)) {
    return <HeicImage url={url} alt={alt} />;
  }

  if (kind === 'image' || kind === 'vector') {
    return <Box component="img" src={url} alt={alt || ''} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: full ? 'contain' : 'contain' }} />;
  }

  if (kind === 'video') {
    return (
      <Box
        component="video"
        src={url}
        muted
        playsInline
        preload="metadata"
        controls={full}
        sx={{ width: '100%', height: '100%', objectFit: full ? 'contain' : 'cover', bgcolor: '#000', display: 'block' }}
      />
    );
  }

  if (isPdf(url, filename, contentType)) {
    return (
      <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', bgcolor: '#fff', position: 'relative' }}>
        <Box
          component="iframe"
          title={alt || 'PDF preview'}
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          sx={{ border: 0, width: '100%', height: full ? 560 : '100%', pointerEvents: full ? 'auto' : 'none' }}
        />
      </Box>
    );
  }

  if (kind === 'audio' && full) {
    return (
      <Stack spacing={1.5} alignItems="center" sx={{ p: 2, width: '100%' }}>
        <Icon size={40} color={MEDIA_META[kind].color} />
        <Box component="audio" controls src={url} sx={{ width: '100%' }} />
      </Stack>
    );
  }

  // audio (thumb) / design / archive / font / other → kind icon + extension label
  return (
    <Stack alignItems="center" spacing={0.5} sx={{ color: MEDIA_META[kind].color }}>
      <Icon size={full ? 48 : 30} />
      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', fontSize: full ? 12 : 10 }}>
        {(filename || '').split('.').pop()?.slice(0, 6) || kind}
      </Typography>
    </Stack>
  );
}
