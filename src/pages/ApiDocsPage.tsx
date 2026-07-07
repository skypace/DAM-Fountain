import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, Paper, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { Copy, Check, KeyRound, Play, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useIsAdmin } from '../lib/useIsAdmin';
import { useToast } from '../components/Toast';

const PARAMS: Array<[string, string]> = [
  ['q', 'Free text matched against asset title + filename (e.g. "margarita").'],
  ['brand', 'Brand slug: top-hat-provisions, alameda, brix, barfly, origins-craft-soda, shared.'],
  ['type', 'Asset type: logo, can, equipment, hero, testimonial, sell-sheet, other.'],
  ['tag', 'Filter to assets carrying this tag name.'],
  ['media', 'image | video | audio | pdf.'],
  ['limit', 'Max results, default 30, max 100.'],
  ['id', 'Fetch a single asset by uuid (returns tags + collections).'],
  ['brands', '=1 → list brand slugs + labels.'],
  ['collections', '=1 → list folders/collections.'],
];

function Code({ children }: { children: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(children); setCopied(true); toast('Copied.'); setTimeout(() => setCopied(false), 1200); };
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1, bgcolor: 'action.hover', position: 'relative' }}>
      <Box component="pre" sx={{ m: 0, overflowX: 'auto', fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', pr: 4 }}>
        {children}
      </Box>
      <Tooltip title="Copy">
        <IconButton size="small" onClick={copy} sx={{ position: 'absolute', top: 6, right: 6 }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
      <Stack spacing={1.25}>
        <Typography variant="subtitle1" fontWeight={800}>{title}</Typography>
        {children}
      </Stack>
    </Paper>
  );
}

export function ApiDocsPage() {
  const isAdmin = useIsAdmin();
  const base = useMemo(() => `${window.location.origin}/api/assets`, []);
  const [testToken, setTestToken] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function runTest() {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch(`${base}?brands=1&key=${encodeURIComponent(testToken.trim())}`);
      const text = await res.text();
      let pretty = text; try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
      setTestResult({ ok: res.ok, text: `HTTP ${res.status}\n${pretty}` });
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally { setTesting(false); }
  }

  if (isAdmin === null) {
    return <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>;
  }
  if (!isAdmin) {
    return (
      <Stack spacing={2}>
        <PageHeader title="API Access" subtitle="Admin only" />
        <Alert severity="warning" icon={<ShieldAlert size={18} />}>
          This page is available to Fountain DAM admins only. Ask a superadmin if you need API access to the asset library.
        </Alert>
      </Stack>
    );
  }

  const curl = `curl "${base}?brand=top-hat-provisions&limit=5" \\\n  -H "Authorization: Bearer $DAM_API_TOKEN"`;
  const sample = `{
  "count": 2,
  "assets": [
    {
      "id": "…uuid…",
      "title": "Top Hat Classic Tonic Syrup 32oz",
      "brand": "top-hat-provisions",
      "type": "other",
      "tags": ["syrup", "tonic"],
      "url": "https://…/storage/v1/object/public/brand-assets/…png",
      "thumbnailUrl": "https://…png",
      "description": null
    }
  ]
}`;

  return (
    <Stack spacing={2}>
      <PageHeader
        title="API Access"
        subtitle="Read-only JSON API into the brand asset library — for Claude and other tools. Admin only."
      />

      <Section title="Overview">
        <Typography variant="body2" color="text.secondary">
          A single read-only endpoint that lists and searches the asset library and returns public file URLs plus metadata.
          It never modifies anything — tagging and editing stay in the app. Give the URL (with a token) to Claude or any tool
          that can make an HTTP request, and it can find brand/product images and pull the <code>url</code> of each into
          proposals, decks, or emails.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" color="primary" variant="outlined" label="GET only" />
          <Chip size="small" variant="outlined" label="Read-only" />
          <Chip size="small" variant="outlined" label="Token-gated" />
        </Stack>
      </Section>

      <Section title="Endpoint">
        <Code>{base}</Code>
      </Section>

      <Section title="Authentication">
        <Typography variant="body2" color="text.secondary">
          Every request must carry the shared token, either as a header or a query param:
        </Typography>
        <Code>{`Authorization: Bearer <DAM_API_TOKEN>`}</Code>
        <Typography variant="body2" color="text.secondary">…or, easiest for pasting into a chat:</Typography>
        <Code>{`${base}?key=<DAM_API_TOKEN>`}</Code>
        <Alert severity="info" icon={<KeyRound size={18} />}>
          The token is the Netlify environment variable <b>DAM_API_TOKEN</b> on the <b>fountain-dam</b> site. Set it to enable
          the API; change it to instantly revoke access. Until it&apos;s set the endpoint returns <code>503</code> and exposes nothing.
          Generate one with <code>node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"</code>.
        </Alert>
      </Section>

      <Section title="Query parameters">
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell sx={{ fontWeight: 700 }}>Param</TableCell><TableCell sx={{ fontWeight: 700 }}>Description</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {PARAMS.map(([k, d]) => (
                <TableRow key={k}>
                  <TableCell><code>{k}</code></TableCell>
                  <TableCell>{d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Section>

      <Section title="Examples">
        <Typography variant="body2" color="text.secondary">All Top Hat assets:</Typography>
        <Code>{`${base}?key=<DAM_API_TOKEN>&brand=top-hat-provisions`}</Code>
        <Typography variant="body2" color="text.secondary">Search + filter (curl with header):</Typography>
        <Code>{curl}</Code>
        <Typography variant="body2" color="text.secondary">List available brands:</Typography>
        <Code>{`${base}?key=<DAM_API_TOKEN>&brands=1`}</Code>
      </Section>

      <Section title="Response shape">
        <Code>{sample}</Code>
        <Typography variant="body2" color="text.secondary">
          <code>url</code> is the direct public file link (works in a browser, an <code>&lt;img&gt;</code>, or a download).
        </Typography>
      </Section>

      <Section title="Give it to Claude">
        <Typography variant="body2" color="text.secondary">
          Paste this into Claude and it can search the library and use the returned URLs:
        </Typography>
        <Code>{`You have a read-only Brand Asset API at:
${base}?key=<DAM_API_TOKEN>

Add query params to search: brand=, q=, type=, tag=, media=, limit=.
Each result has a "url" field — the direct public image link.
Use it to find on-brand images and include their urls in what you build.`}</Code>
      </Section>

      <Section title="Test the connection">
        <Typography variant="body2" color="text.secondary">
          Paste the token to confirm the endpoint is live (calls <code>?brands=1</code>). The token is not stored.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <TextField
            size="small" type="password" label="DAM_API_TOKEN" value={testToken}
            onChange={(e) => setTestToken(e.target.value)} sx={{ minWidth: 280 }}
            InputProps={{ startAdornment: <KeyRound size={15} style={{ marginRight: 6, opacity: 0.6 }} /> }}
          />
          <Button
            variant="contained" disabled={!testToken.trim() || testing}
            startIcon={testing ? <CircularProgress size={16} /> : <Play size={16} />}
            onClick={runTest}
          >
            Test
          </Button>
        </Stack>
        {testResult && (
          <>
            <Divider />
            <Alert severity={testResult.ok ? 'success' : 'error'}>{testResult.ok ? 'Endpoint responded OK.' : 'Request failed — check the token / that DAM_API_TOKEN is set.'}</Alert>
            <Code>{testResult.text}</Code>
          </>
        )}
      </Section>
    </Stack>
  );
}
