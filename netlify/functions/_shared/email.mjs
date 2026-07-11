// Outbound email for Fountain DAM (welcome / access-granted notifications).
// Sends via Resend. RESEND_API_KEY must be set in the fountain-dam Netlify env;
// without it every send is a silent no-op ({ sent: false }) so member creation
// never fails because of email.
import { randomBytes } from 'node:crypto';

// Supabase password policy on this project requires lower + upper + digit +
// symbol. Generate a 16-char temp password guaranteed to satisfy all four.
export function tempPassword() {
  const sets = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*-_+='];
  const all = sets.join('');
  const rb = randomBytes(32);
  const chars = sets.map((s, i) => s[rb[i] % s.length]);
  for (let i = 4; i < 16; i++) chars.push(all[rb[i] % all.length]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rb[16 + i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.RESEND_FROM || 'Fountain DAM <alerts@alamedapointbg.com>';
const DAM_URL = process.env.DAM_PUBLIC_URL || 'https://fountain-dam.netlify.app';

export async function sendEmail({ to, subject, html, text }) {
  if (!RESEND_API_KEY) {
    console.warn('email: RESEND_API_KEY not set — skipping send to', to);
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      console.error('email: Resend send failed', res.status, body);
      return { sent: false, error: `Resend ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('email: send error', e);
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const ROLE_BLURB = {
  viewer: 'browse and download brand assets',
  contributor: 'browse, upload, tag and share brand assets',
  admin: 'manage assets and users',
};

function shell(inner) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:#0F172A;padding:26px 34px">
      <div style="color:#ffffff;font-size:21px;font-weight:800;letter-spacing:-.01em">Fountain <span style="color:#60a5fa;font-weight:600">· Brand Asset Library</span></div>
      <div style="color:#94a3b8;font-size:12.5px;margin-top:3px">Alameda Point Beverage Group / Brix</div>
    </td></tr>
    <tr><td style="padding:30px 34px 34px">${inner}</td></tr>
    <tr><td style="padding:18px 34px;border-top:1px solid #e2e8f0">
      <div style="color:#94a3b8;font-size:12px;line-height:1.5">Questions? Reply to this email or call 1-800-373-5098.<br>Alameda Point Beverage Group · 1951 Monarch St #200, Alameda, CA 94501</div>
    </td></tr>
  </table>
  </td></tr></table></body></html>`;
}

// New account: credentials block with the temp password.
export function sendWelcomeEmail({ to, password, role }) {
  const blurb = ROLE_BLURB[role] || ROLE_BLURB.viewer;
  const inner = `
    <div style="color:#0f172a;font-size:17px;font-weight:700;margin-bottom:10px">Your Fountain account is ready.</div>
    <p style="color:#475569;font-size:14.5px;line-height:1.6;margin:0 0 22px">You've been given <b>${role}</b> access to Fountain, the brand asset library — you can ${blurb}.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px"><tr><td style="padding:20px 24px">
      <div style="color:#64748b;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Sign-in details</div>
      <div style="color:#0f172a;font-size:14px;line-height:2">
        <b>URL:</b> <a href="${DAM_URL}" style="color:#2563eb">${DAM_URL.replace(/^https?:\/\//, '')}</a><br>
        <b>Email:</b> ${to}<br>
        <b>Temporary password:</b> <span style="font-family:ui-monospace,Menlo,monospace;background:#eef2f7;padding:2px 8px;border-radius:6px">${password}</span>
      </div>
    </td></tr></table>
    <p style="color:#475569;font-size:13px;line-height:1.6;margin:18px 0 24px">Please sign in and change your password from your profile. This temporary password won't be shown again.</p>
    <a href="${DAM_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14.5px;font-weight:700;text-decoration:none;padding:12px 26px;border-radius:999px">Open Fountain →</a>`;
  const text = `Your Fountain account is ready.\n\nSign in at ${DAM_URL}\nEmail: ${to}\nTemporary password: ${password}\n\nYou have ${role} access. Please change your password after signing in.`;
  return sendEmail({ to, subject: 'Welcome to Fountain — your sign-in details', html: shell(inner), text });
}

// Existing account granted DAM access: no credentials, just the link.
export function sendAccessEmail({ to, role }) {
  const blurb = ROLE_BLURB[role] || ROLE_BLURB.viewer;
  const inner = `
    <div style="color:#0f172a;font-size:17px;font-weight:700;margin-bottom:10px">You now have access to Fountain.</div>
    <p style="color:#475569;font-size:14.5px;line-height:1.6;margin:0 0 24px">Your existing APBG account (<b>${to}</b>) has been given <b>${role}</b> access to Fountain, the brand asset library — you can ${blurb}. Sign in with your usual email and password.</p>
    <a href="${DAM_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14.5px;font-weight:700;text-decoration:none;padding:12px 26px;border-radius:999px">Open Fountain →</a>`;
  const text = `You now have ${role} access to Fountain, the brand asset library.\nSign in with your existing account at ${DAM_URL}`;
  return sendEmail({ to, subject: 'You now have access to Fountain — Brand Asset Library', html: shell(inner), text });
}
