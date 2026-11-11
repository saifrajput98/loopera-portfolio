# Loopera — setup & launch checklist

Static site + PHP contact form (`contact.php`, PHPMailer SMTP, reCAPTCHA v3). PHP 8.1+ on Apache/cPanel.

## 1. Deploy
Upload/deploy ONLY: `index.html`, `contact.php`, `phpmailer/`, `assets/`, `.well-known/`, `.htaccess`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `site.webmanifest`.
With cPanel Git deploy, `.cpanel.yml` does this: replace `USERNAME` in it first.

## 2. Secrets file (NOT in git, NOT in public_html)
Create `/home/<cpanel-user>/loopera-config.php` (one level above `public_html`):

    <?php
    return [
      'host'   => 'mail.looperatech.com',
      'user'   => 'info@looperatech.com',
      'pass'   => 'MAILBOX_PASSWORD',
      'recaptcha_secret' => 'RECAPTCHA_SECRET_KEY',
      'admins' => ['info@looperatech.com', 'saifrajput98@gmail.com'],
    ];

The site key (public) is `RECAPTCHA_SITE_KEY` at the top of the form code in `assets/js/main.js`.

## 3. Troubleshooting
- cPanel → Errors (or `error_log` in `public_html`) shows lines such as `Loopera admin mail failed`, `reCAPTCHA rejected`, `config file missing`.
- SMTP: use the "Secure SSL/TLS" settings from cPanel → Email Accounts → Connect Devices. For port 587 use `ENCRYPTION_STARTTLS` and `Port = 587` in `makeMailer()`.
- reCAPTCHA: the domain must be listed on the key; `MIN_SCORE` in `contact.php` defaults to 0.5.
- Enable SPF + DKIM (cPanel → Email Deliverability) and add a DMARC record.

## 4. Headers
In `.htaccess` (Apache) or `nginx.conf.example`. The CSP allows Google reCAPTCHA and one inline script pinned by hash.
