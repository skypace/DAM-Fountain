import { Image as ImageIcon, PenTool, Palette, Film, Music, FileText, Archive, Type, File, type LucideIcon } from 'lucide-react';

export type MediaKind = 'image' | 'vector' | 'design' | 'video' | 'audio' | 'document' | 'archive' | 'font' | 'other';

export const MEDIA_KINDS: MediaKind[] = ['image', 'vector', 'design', 'video', 'audio', 'document', 'archive', 'font', 'other'];

const EXT_KIND: Record<string, MediaKind> = {
  // images
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image', bmp: 'image', tif: 'image', tiff: 'image', heic: 'image', ico: 'image',
  // vector
  svg: 'vector', eps: 'vector',
  // design source files
  ai: 'design', psd: 'design', sketch: 'design', fig: 'design', xd: 'design', indd: 'design', afdesign: 'design', afphoto: 'design',
  // video
  mp4: 'video', mov: 'video', webm: 'video', avi: 'video', mkv: 'video', m4v: 'video', wmv: 'video',
  // audio
  mp3: 'audio', wav: 'audio', m4a: 'audio', m4p: 'audio', aac: 'audio', ogg: 'audio', flac: 'audio',
  // documents
  pdf: 'document', doc: 'document', docx: 'document', ppt: 'document', pptx: 'document', xls: 'document', xlsx: 'document', txt: 'document', csv: 'document', key: 'document', pages: 'document', rtf: 'document',
  // archives
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  // fonts
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',
};

export function mediaKind(contentType?: string | null, filename?: string | null): MediaKind {
  const ext = String(filename || '').toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/)?.[1];
  if (ext && EXT_KIND[ext]) return EXT_KIND[ext];
  const ct = String(contentType || '').toLowerCase();
  if (ct.startsWith('image/')) return ct.includes('svg') ? 'vector' : 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';
  if (ct === 'application/pdf') return 'document';
  if (ct.startsWith('font/')) return 'font';
  if (ct.includes('zip') || ct.includes('compressed') || ct.includes('tar')) return 'archive';
  if (ct.includes('word') || ct.includes('excel') || ct.includes('spreadsheet') || ct.includes('presentation') || ct.startsWith('text/')) return 'document';
  return 'other';
}

export const MEDIA_META: Record<MediaKind, { label: string; icon: LucideIcon; color: string }> = {
  image: { label: 'Images', icon: ImageIcon, color: '#2563eb' },
  vector: { label: 'Vector', icon: PenTool, color: '#7c3aed' },
  design: { label: 'Design files', icon: Palette, color: '#db2777' },
  video: { label: 'Video', icon: Film, color: '#dc2626' },
  audio: { label: 'Audio', icon: Music, color: '#059669' },
  document: { label: 'Documents', icon: FileText, color: '#0891b2' },
  archive: { label: 'Archives', icon: Archive, color: '#b45309' },
  font: { label: 'Fonts', icon: Type, color: '#4b5563' },
  other: { label: 'Other', icon: File, color: '#64748b' },
};
