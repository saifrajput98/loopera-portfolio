<?php
// POST /contact.php — contact form handler (Apache/cPanel + PHP 7.4+).
// Edit the CONFIG block, upload this file next to index.html. No third-party services needed.

// ---- CONFIG ----
const TO_EMAIL   = 'info@looperatech.com';            // where enquiries arrive (fixed; visitors can't change it)
const FROM_EMAIL = 'hello@looperatech.com';           // must be an address on YOUR domain (create it in cPanel)
const ALLOWED_ORIGINS = ['https://looperatech.com', 'https://www.looperatech.com'];
const MIN_FILL_MS = 3000;                             // forms submitted faster than this are bots
const LIMITS = [[600, 3], [86400, 10]];               // [window seconds, max sends] per IP
// ----------------

const SERVICES = ['WordPress Development', 'Web Design & Development', 'GoHighLevel / CRM', 'Zapier or n8n Automation', 'Care & Improvements', 'Something Else'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply(int $status, array $body, array $extra = []): never {
    http_response_code($status);
    foreach ($extra as $k => $v) header("$k: $v");
    echo json_encode($body);
    exit;
}
function len(string $v): int { return (int)preg_match_all('/./su', $v); } // UTF-8 length, no mbstring needed
function squash($v): string { return trim(preg_replace('/\s+/u', ' ', (string)($v ?? ''))); }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reply(405, ['ok' => false, 'error' => 'method_not_allowed'], ['Allow' => 'POST']);
if (!in_array($_SERVER['HTTP_ORIGIN'] ?? '', ALLOWED_ORIGINS, true)) reply(403, ['ok' => false, 'error' => 'forbidden']);
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) reply(415, ['ok' => false, 'error' => 'unsupported']);

$raw = file_get_contents('php://input', false, null, 0, 10241);
if ($raw === false || strlen($raw) > 10240) reply(413, ['ok' => false, 'error' => 'too_large']);
$in = json_decode($raw, true);
if (!is_array($in) || array_is_list($in)) reply(400, ['ok' => false, 'error' => 'bad_request']);

// Honeypot (pretend success) + too-fast check
if (!empty($in['website'])) reply(200, ['ok' => true]);
$ts = $in['ts'] ?? null;
if (!is_numeric($ts) || (microtime(true) * 1000 - $ts) < MIN_FILL_MS) reply(400, ['ok' => false, 'error' => 'too_fast']);

// Per-IP rate limit (file based, in the system temp dir). Uses REMOTE_ADDR only; headers can be spoofed.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$file = sys_get_temp_dir() . '/loopera_rl_' . hash('sha256', $ip);
$fh = fopen($file, 'c+');
if ($fh && flock($fh, LOCK_EX)) {
    $now = time();
    $log = array_values(array_filter(array_map('intval', explode("\n", trim(stream_get_contents($fh)))), fn($t) => $t > $now - 86400));
    foreach (LIMITS as [$win, $max]) {
        if (count(array_filter($log, fn($t) => $t > $now - $win)) >= $max) {
            flock($fh, LOCK_UN); fclose($fh);
            reply(429, ['ok' => false, 'error' => 'rate_limited'], ['Retry-After' => '600']);
        }
    }
    $log[] = $now;
    ftruncate($fh, 0); rewind($fh); fwrite($fh, implode("\n", $log));
    flock($fh, LOCK_UN);
}
if ($fh) fclose($fh);

// Validation (mirrors the browser-side rules)
$name = squash($in['name'] ?? '');
$email = squash($in['email'] ?? '');
$service = is_string($in['service'] ?? null) ? $in['service'] : '';
$message = trim(preg_replace('/\r\n?/', "\n", (string)($in['message'] ?? '')));
$ctrl = '/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/';
$tag = '/<\s*\/?\s*[a-z!][^>]*>/i';
$bad = [];
if (len($name) < 2 || len($name) > 80 || preg_match('/[<>]/', $name) || preg_match($ctrl, $name)) $bad[] = 'name';
if (!$email || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || str_contains($email, '..')) $bad[] = 'email';
if (!in_array($service, SERVICES, true)) $bad[] = 'service';
if (len($message) < 10 || len($message) > 2000 || preg_match($tag, $message) || preg_match($ctrl, $message) || preg_match_all('~https?://~i', $message) > 2) $bad[] = 'message';
if ($bad) reply(400, ['ok' => false, 'error' => 'validation', 'fields' => $bad]);

// Send (plain text; all values are already stripped of newlines where they go into headers)
$subject = '=?UTF-8?B?' . base64_encode("New Loopera enquiry — $service") . '?=';
$body = "New enquiry via Loopera\n\nName: $name\nEmail: $email\nService: $service\n\n$message\n";
$headers = [
    'From' => 'Loopera <' . FROM_EMAIL . '>',
    'Reply-To' => $email,
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'X-Mailer' => 'Loopera contact form',
];
$ok = @mail(TO_EMAIL, $subject, $body, $headers, '-f' . FROM_EMAIL);
$ok ? reply(200, ['ok' => true]) : reply(502, ['ok' => false, 'error' => 'send_failed']);
