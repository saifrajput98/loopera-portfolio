# Loopera — security setup & launch checklist

The site is static, and the contact form posts to `/api/contact` (a Cloudflare Pages Function in
`functions/api/contact.js`). Nothing secret ever appears in HTML/JS.

## 1. One-time setup (before launch)
1. **Host** on Cloudflare Pages (recommended — free SSL, Functions, Turnstile, WAF). Connect the repo, no build command, output dir `/`.
2. **Turnstile:** Cloudflare dashboard → Turnstile → add your domain → put the *site key* in `index.html` (`data-sitekey="YOUR_TURNSTILE_SITE_KEY"`) and the *secret key* as the `TURNSTILE_SECRET` secret.
3. **Email service (Resend):** create account → add & verify your domain → create an API key → set `RESEND_API_KEY` (secret).
4. **Environment variables** (Pages → Settings): `TO_EMAIL` (where enquiries arrive), `FROM_EMAIL` (e.g. `Loopera <hello@looperatech.com>`), `ALLOWED_ORIGIN` (`https://looperatech.com`).
5. **Rate limiting:** Workers & Pages → KV → create namespace → bind it to the project as `RATE_KV` (3 sends / 10 min and 10 / day per IP). Also add a Cloudflare WAF rate-limiting rule for `POST /api/contact`.
6. Domain is already set to `looperatech.com` in index.html, robots.txt, sitemap.xml and .well-known/security.txt — just confirm it matches your live domain.

## 2. DNS for email (SPF, DKIM, DMARC)
Resend shows the exact records after you add your domain — copy them verbatim.
- **SPF** (TXT): `v=spf1 include:<provider-value> ~all` — one SPF record per domain only.
- **DKIM** (TXT/CNAME): the key records your provider gives you.
- **DMARC** (TXT at `_dmarc`): start with `v=DMARC1; p=none; rua=mailto:dmarc@looperatech.com`, watch reports for 2–4 weeks, then move to `p=quarantine`, then `p=reject`.

## 3. HTTPS & headers
- Cloudflare: SSL/TLS → **Full (strict)**, turn on **Always Use HTTPS**, **HSTS** and **Automatic HTTPS Rewrites**.
- Headers are in `_headers` (Cloudflare Pages/Netlify). Apache → `.htaccess`. Nginx → `nginx.conf.example`. Use only the one matching your host.
- Only add `preload` to HSTS after the whole domain (and subdomains) is permanently HTTPS.
- The CSP allows exactly one inline script (the `js-ready` line in `<head>`, pinned by hash). If you edit that line, regenerate the hash.

## 4. Keep it updated
`npm install` → `npm outdated` → `npm update` → `npm run vendor` (copies GSAP + fonts into `assets/`). Dependabot (`.github/dependabot.yml`) opens weekly update PRs.

## 5. Test after launch
securityheaders.com · ssllabs.com/ssltest · observatory.mozilla.org · mail-tester.com (send a test enquiry) · dmarcian/MXToolbox for SPF/DKIM/DMARC.
