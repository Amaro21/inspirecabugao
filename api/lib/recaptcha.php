<?php
// api/lib/recaptcha.php — Google reCAPTCHA v2 server-side verification.

// Uses cURL when available (more reliable on shared hosts that disable
// allow_url_fopen), falling back to file_get_contents otherwise.
function verifyRecaptcha($token, $remoteIp) {
    $params = [
        'secret'   => RECAPTCHA_SECRET_KEY,
        'response' => $token,
        'remoteip' => $remoteIp,
    ];
    $response = null;
    if (function_exists('curl_init')) {
        $ch = curl_init('https://www.google.com/recaptcha/api/siteverify');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        $response = curl_exec($ch);
        curl_close($ch);
    }
    if (!$response) {
        $response = @file_get_contents('https://www.google.com/recaptcha/api/siteverify?' . http_build_query($params));
    }
    if (!$response) return false;
    $result = json_decode($response, true);
    return !empty($result['success']);
}
