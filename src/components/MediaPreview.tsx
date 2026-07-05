import { Box, Stack, Typography } from '@mui/material';
import { mediaKind, MEDIA_META } from '../lib/media';

const isPdf = (url: string, filename?: string | null, ct?: string | null) =>
  /\.pdf(\?|#|$)/i.test(url) || /\.pdf$/i.test(filename || '') || ct === 'application/pdf';

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
