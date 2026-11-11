<?php
// POST /contact.php — contact form handler (Apache/cPanel + PHP 7.4+).
// Secrets (SMTP password, reCAPTCHA secret, admin emails) live OUTSIDE public_html in
// /home/<cpanel-user>/loopera-config.php  (see SECURITY-SETUP.md).

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/phpmailer/Exception.php';
require __DIR__ . '/phpmailer/PHPMailer.php';
require __DIR__ . '/phpmailer/SMTP.php';

// ---- CONFIG ----
const ALLOWED_ORIGINS = ['https://looperatech.com', 'https://www.looperatech.com'];
const MIN_FILL_MS = 3000;               // forms submitted faster than this are bots
const MIN_SCORE = 0.5;                  // reCAPTCHA v3 score threshold (lower = more permissive)
const LIMITS = [[600, 3], [86400, 10]]; // [window seconds, max sends] per IP
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

$cfgFile = dirname(__DIR__) . '/loopera-config.php';
$cfg = is_file($cfgFile) ? require $cfgFile : null;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reply(405, ['ok' => false, 'error' => 'method_not_allowed'], ['Allow' => 'POST']);
if (!is_array($cfg)) { error_log('Loopera: config file missing at ' . $cfgFile); reply(500, ['ok' => false, 'error' => 'server_config']); }
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

// Per-IP rate limit (file based, system temp dir). Uses REMOTE_ADDR only; headers can be spoofed.
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

// reCAPTCHA v3 verification
$token = is_string($in['g-recaptcha-response'] ?? null) ? $in['g-recaptcha-response'] : '';
if ($token === '' || strlen($token) > 4096) reply(400, ['ok' => false, 'error' => 'captcha_failed']);
$post = http_build_query(['secret' => $cfg['recaptcha_secret'], 'response' => $token, 'remoteip' => $ip]);
$res = false;
if (function_exists('curl_init')) {
    $ch = curl_init('https://www.google.com/recaptcha/api/siteverify');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $post, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5]);
    $res = curl_exec($ch);
    curl_close($ch);
} else {
    $res = @file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, stream_context_create(['http' => [
        'method' => 'POST', 'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => $post, 'timeout' => 5,
    ]]));
}
$v = $res ? json_decode($res, true) : null;
if (!is_array($v)
    || empty($v['success'])
    || ($v['action'] ?? '') !== 'contact'
    || ($v['score'] ?? 0) < MIN_SCORE
    || !in_array($v['hostname'] ?? '', ['looperatech.com', 'www.looperatech.com'], true)) {
    error_log('reCAPTCHA rejected: ' . ($res ?: 'no response'));
    reply(400, ['ok' => false, 'error' => 'captcha_failed']);
}

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

// Send via SMTP
function makeMailer(array $cfg): PHPMailer {
    $m = new PHPMailer(true);
    $m->isSMTP();
    $m->Host = $cfg['host'];
    $m->SMTPAuth = true;
    $m->Username = $cfg['user'];
    $m->Password = $cfg['pass'];
    $m->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $m->Port = 465;
    $m->CharSet = 'UTF-8';
    $m->Timeout = 15;
    $m->setFrom($cfg['user'], 'Loopera');
    return $m;
}

// 1) Notify admins (must succeed)
try {
    $a = makeMailer($cfg);
    foreach ($cfg['admins'] as $to) $a->addAddress($to);
    $a->addReplyTo($email, $name);
    $a->Subject = "New Loopera enquiry — $service";
    $a->Body = "New enquiry via Loopera\n\nName: $name\nEmail: $email\nService: $service\n\n$message\n";
    $a->send();
} catch (Exception $e) {
    error_log('Loopera admin mail failed: ' . $e->getMessage());
    reply(502, ['ok' => false, 'error' => 'send_failed']);
}

// 2) Confirmation to the visitor (if this fails the enquiry still counts as sent)
try {
    $c = makeMailer($cfg);
    $c->addAddress($email, $name);
    $c->addReplyTo($cfg['user'], 'Loopera');
    $c->Subject = 'Thanks for contacting Loopera';
    $c->Body = "Hi $name,\n\nThank you for getting in touch. I've received your enquiry about \"$service\" and will get back to you soon, usually within 1–2 working days.\n\nHere is a copy of your message:\n\n$message\n\nBest regards,\nSaif Ur Rehman\nLoopera\nhttps://looperatech.com\n";
    $c->send();
} catch (Exception $e) {
    error_log('Loopera confirmation mail failed: ' . $e->getMessage());
}

reply(200, ['ok' => true]);
