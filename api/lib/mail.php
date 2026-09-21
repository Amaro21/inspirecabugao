<?php
// api/lib/mail.php — outbound email delivery.
// Tries real Gmail SMTP first (reliable — actually reaches inboxes),
// falling back to PHP's built-in mail() if no Gmail SMTP credentials are
// configured. Either path can NEVER crash the request — password reset,
// account creation, etc. always succeed from the user's perspective even
// if the email itself fails to send.

function safeSendMail($to, $subject, $body, $fromName = APP_NAME) {
    try {
        if (!empty(GMAIL_SMTP_USER) && !empty(GMAIL_SMTP_APP_PASSWORD)) {
            $ok = sendViaGmailSMTP($to, $subject, $body, $fromName);
            if ($ok) return true;
        }
    } catch (Throwable $e) {
        // fall through to mail() below
    }
    // Fallback: PHP's built-in mail() — swap out the error handler for the
    // duration of the call so a failure (e.g. no local mail server) can
    // never surface as a crash, regardless of @ suppression edge cases.
    $previousHandler = set_error_handler(function() { return true; });
    try {
        $headers = "From: $fromName <no-reply@" . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ">\r\n";
        @mail($to, $subject, $body, $headers);
    } catch (Throwable $e) {
        // Ignore — sending the email is best-effort only.
    } finally {
        set_error_handler($previousHandler);
    }
    return false;
}

// Sends an automatic backup email with the .sql file attached. No mail()
// fallback here on purpose — an unattributed text email saying "a backup
// happened" without the actual file would be useless; if Gmail SMTP isn't
// configured, there's nothing meaningful to fall back to.
function sendBackupEmail($to, $subject, $body, $filename, $attachmentContent) {
    if (empty(GMAIL_SMTP_USER) || empty(GMAIL_SMTP_APP_PASSWORD)) return false;
    try {
        return sendViaGmailSMTP($to, $subject, $body, APP_NAME, $filename, $attachmentContent);
    } catch (Throwable $e) {
        return false;
    }
}

// Opens an authenticated Gmail SMTP connection ready for MAIL FROM/RCPT
// TO/DATA. Shared by both the plain-text send and the attachment send
// below, since the connect+STARTTLS+AUTH LOGIN steps are identical either
// way — only the DATA payload differs.
function _gmailSmtpConnect($to) {
    $host = 'smtp.gmail.com';
    $port = 587;
    $user = GMAIL_SMTP_USER;
    $pass = GMAIL_SMTP_APP_PASSWORD;

    $sock = @stream_socket_client("tcp://$host:$port", $errno, $errstr, 10);
    if (!$sock) return false;
    stream_set_timeout($sock, 10);

    $read = function($s) {
        $data = '';
        while ($line = fgets($s, 515)) {
            $data .= $line;
            if (substr($line, 3, 1) === ' ') break; // last line of a multi-line response
        }
        return $data;
    };
    $write = function($s, $cmd) { fwrite($s, $cmd . "\r\n"); };

    $read($sock); // server greeting
    $write($sock, "EHLO inspirecabugao");
    $read($sock);
    $write($sock, "STARTTLS");
    $resp = $read($sock);
    if (strpos($resp, '220') !== 0) { fclose($sock); return false; }

    if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        fclose($sock);
        return false;
    }

    $write($sock, "EHLO inspirecabugao");
    $read($sock);
    $write($sock, "AUTH LOGIN");
    $read($sock);
    $write($sock, base64_encode($user));
    $read($sock);
    $write($sock, base64_encode($pass));
    $resp = $read($sock);
    if (strpos($resp, '235') !== 0) { fclose($sock); return false; } // auth failed

    $write($sock, "MAIL FROM:<$user>");
    $read($sock);
    $write($sock, "RCPT TO:<$to>");
    $resp = $read($sock);
    if (strpos($resp, '250') !== 0) { fclose($sock); return false; }

    return ['sock' => $sock, 'read' => $read, 'write' => $write, 'user' => $user];
}

// Minimal hand-rolled SMTP client for sending through Gmail's servers.
// No external library needed — just raw sockets + STARTTLS + AUTH LOGIN.
// Optionally attaches a file (used for the automatic backup email) by
// building a multipart/mixed MIME message instead of a plain text body.
function sendViaGmailSMTP($to, $subject, $body, $fromName, $attachFilename = null, $attachContent = null) {
    $conn = _gmailSmtpConnect($to);
    if (!$conn) return false;
    [$sock, $read, $write, $user] = [$conn['sock'], $conn['read'], $conn['write'], $conn['user']];

    $write($sock, "DATA");
    $read($sock);

    $headers = "From: $fromName <$user>\r\n"
             . "To: <$to>\r\n"
             . "Subject: $subject\r\n"
             . "Date: " . date('r') . "\r\n"
             . "MIME-Version: 1.0\r\n";

    if ($attachFilename && $attachContent !== null) {
        // multipart/mixed: one text part + one attachment part
        $boundary = 'INSPIRE_' . bin2hex(random_bytes(12));
        $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";

        $escapedBody = preg_replace('/^\./m', '..', $body);
        $payload  = "--$boundary\r\n";
        $payload .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
        $payload .= $escapedBody . "\r\n\r\n";

        $payload .= "--$boundary\r\n";
        $payload .= "Content-Type: application/sql; name=\"$attachFilename\"\r\n";
        $payload .= "Content-Transfer-Encoding: base64\r\n";
        $payload .= "Content-Disposition: attachment; filename=\"$attachFilename\"\r\n\r\n";
        $payload .= chunk_split(base64_encode($attachContent)); // base64 lines never start with "." so DATA escaping is moot here
        $payload .= "--$boundary--\r\n";

        $write($sock, $headers . "\r\n" . $payload . "\r\n.");
    } else {
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $escapedBody = preg_replace('/^\./m', '..', $body);
        $write($sock, $headers . "\r\n" . $escapedBody . "\r\n.");
    }

    $resp = $read($sock);
    $write($sock, "QUIT");
    fclose($sock);

    return strpos($resp, '250') === 0;
}

