# Loopera — setup & launch checklist

Static site. The contact form posts to `/contact.php` (PHP 7.4+/8.x on Apache/cPanel). Nothing secret appears in HTML/JS.

## 1. Deploy
Upload ONLY: `index.html`, `contact.php`, `assets/`, `.well-known/`, `.htaccess`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `site.webmanifest`.
Do not upload `package.json`, `scripts/`, `.github/`, `*.md` or `nginx.conf.example`.

## 2. Contact form
1. In `contact.php` set `TO_EMAIL`, `FROM_EMAIL` and `ALLOWED_ORIGINS`.
2. `FROM_EMAIL` must be a real mailbox on your domain (create it in cPanel) so mail passes SPF/DKIM.
3. Test with a real enquiry, then check the spam folder. If mail never arrives, ask your host whether PHP `mail()` is enabled, or tell me and I'll switch it to SMTP.
4. Protection: honeypot field, 3-second minimum fill time, per-IP rate limit (3 per 10 min, 10 per day), strict validation and a fixed recipient. There is no CAPTCHA now; if spam appears, add hCaptcha or reCAPTCHA.

## 3. DNS for email (SPF, DKIM, DMARC)
Enable SPF and DKIM in cPanel (Email Deliverability) and add DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@looperatech.com`. Move to `quarantine`, then `reject`, after 2–4 weeks of clean reports.

## 4. HTTPS & headers
Headers live in `.htaccess` (Apache) or `nginx.conf.example` (Nginx). Only add `preload` to HSTS once every subdomain is HTTPS. The CSP allows one inline script (the `js-ready` line in `<head>`, pinned by hash). If you edit that line, regenerate the hash.

## 5. Keep it updated
`npm install` → `npm outdated` → `npm update` → `npm run vendor`. Dependabot opens weekly PRs. Renew `.well-known/security.txt` before its Expires date.

## 6. Test after launch
securityheaders.com · ssllabs.com/ssltest · observatory.mozilla.org · mail-tester.com · MXToolbox.
