// Cloudflare Pages Function: POST /api/contact
// Secrets (never in frontend): TURNSTILE_SECRET, RESEND_API_KEY
// Vars: TO_EMAIL (fixed recipient), FROM_EMAIL (verified sender), ALLOWED_ORIGIN (comma-separated)
// Optional KV binding: RATE_KV (per-IP rate limiting)

const SERVICES = ['WordPress Development', 'Web Design & Development', 'GoHighLevel / CRM', 'Zapier or n8n Automation', 'Care & Improvements', 'Something Else'];
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
const TAG_RE = /<\s*\/?\s*[a-z!][^>]*>/i;
const CTRL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const MAX_BODY = 10 * 1024;
const MIN_FILL_MS = 3000;
const LIMITS = [{ windowSec: 600, max: 3 }, { windowSec: 86400, max: 10 }];

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const reply = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const squash = v => String(v ?? '').replace(/\s+/g, ' ').trim();

export function validate(input) {
  const errors = {};
  const name = squash(input.name);
  const email = squash(input.email);
  const service = typeof input.service === 'string' ? input.service : '';
  const message = String(input.message ?? '').replace(/\r\n?/g, '\n').trim();
  if (name.length < 2 || name.length > 80 || /[<>]/.test(name) || CTRL_RE.test(name)) errors.name = 'invalid';
  if (!email || email.length > 254 || !EMAIL_RE.test(email) || email.includes('..')) errors.email = 'invalid';
  if (!SERVICES.includes(service)) errors.service = 'invalid';
  if (message.length < 10 || message.length > 2000 || TAG_RE.test(message) || CTRL_RE.test(message) || (message.match(/https?:\/\//gi) || []).length > 2) errors.message = 'invalid';
  return { errors, clean: { name, email, service, message } };
}

async function rateLimited(env, ip) {
  if (!env.RATE_KV) return false; // add a KV binding (and a Cloudflare WAF rate-limit rule) for production
  for (const { windowSec, max } of LIMITS) {
    const key = `rl:${windowSec}:${ip}:${Math.floor(Date.now() / 1000 / windowSec)}`;
    const count = parseInt((await env.RATE_KV.get(key)) || '0', 10);
    if (count >= max) return true;
    await env.RATE_KV.put(key, String(count + 1), { expirationTtl: windowSec + 60 });
  }
  return false;
}

async function verifyTurnstile(env, token, ip) {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  return data.success === true && (!data.action || data.action === 'contact');
}

async function sendEmail(env, { name, email, service, message }) {
  const text = `New enquiry via Loopera\n\nName: ${name}\nEmail: ${email}\nService: ${service}\n\n${message}`;
  const html = `<h2>New enquiry via Loopera</h2><p><b>Name:</b> ${esc(name)}<br><b>Email:</b> ${esc(email)}<br><b>Service:</b> ${esc(service)}</p><p style="white-space:pre-wrap">${esc(message)}</p>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    // Recipient is fixed server-side; visitors can never choose where mail goes.
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [env.TO_EMAIL], reply_to: email, subject: `New Loopera enquiry — ${service}`, text, html }),
  });
  return res.ok;
}

export async function onRequestPost({ request, env }) {
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(request.headers.get('Origin') || '')) return reply(403, { ok: false, error: 'forbidden' });
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return reply(415, { ok: false, error: 'unsupported' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return reply(413, { ok: false, error: 'too_large' });
  let input;
  try { input = JSON.parse(raw); } catch { return reply(400, { ok: false, error: 'bad_request' }); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, { ok: false, error: 'bad_request' });

  if (input.website) return reply(200, { ok: true }); // honeypot: pretend success
  if (!Number.isFinite(input.ts) || Date.now() - input.ts < MIN_FILL_MS) return reply(400, { ok: false, error: 'too_fast' });

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (await rateLimited(env, ip)) return reply(429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '600' });

  const token = typeof input['cf-turnstile-response'] === 'string' ? input['cf-turnstile-response'] : '';
  if (!token || token.length > 2048 || !(await verifyTurnstile(env, token, ip))) return reply(400, { ok: false, error: 'captcha_failed' });

  const { errors, clean } = validate(input);
  if (Object.keys(errors).length) return reply(400, { ok: false, error: 'validation', fields: Object.keys(errors) });

  const sent = await sendEmail(env, clean).catch(() => false);
  return sent ? reply(200, { ok: true }) : reply(502, { ok: false, error: 'send_failed' });
}

export const onRequest = () => reply(405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
