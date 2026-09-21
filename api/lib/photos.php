<?php
// api/lib/photos.php — saves incident photo proof as an actual file on
// disk instead of base64 text inside the database.
//
// Why: base64-encoding a photo inflates it by ~33%, and storing that
// directly in a database column means every photo permanently bloats the
// database itself. Many budget hosts (this app has been tested against
// hosts with database quotas as small as 50MB) cap database SIZE far
// more tightly than general disk space — so a handful of incident photos
// could fill the entire database quota in weeks. Storing the actual image
// as a file (with only the file PATH saved in the database) keeps the
// database itself tiny regardless of how many photos accumulate, using
// the much larger general disk space allocation instead.
//
// The frontend needs zero changes for this — <img src="..."> works
// identically whether the src is a data: URI or a relative file path.

define('PHOTO_UPLOAD_BASE_DIR', __DIR__ . '/../../uploads');
define('PHOTO_UPLOAD_BASE_URL_PATH', 'uploads'); // relative path served back to the browser

// Accepts a data: URI string (e.g. "data:image/jpeg;base64,/9j/4AAQ...")
// as submitted by a form (incident report, facility photo, etc). Validates
// it's a genuine image (not just trusting the claimed MIME type), saves it
// under a random filename in uploads/<$subdir>/, and returns the relative
// path to store in the database — or null if no photo was provided / it
// failed validation. $subdir defaults to 'incidents' so existing callers
// that don't pass one keep working unchanged.
function savePhotoFile($dataUri, $subdir = 'incidents') {
    if (empty($dataUri) || !is_string($dataUri)) return null;
    if (!preg_match('/^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/i', $dataUri, $matches)) {
        return null; // not a recognizable image data URI — silently skip rather than fail the whole report
    }
    $ext  = strtolower($matches[1] === 'jpg' ? 'jpeg' : $matches[1]);
    $blob = base64_decode($matches[2], true);
    if ($blob === false || strlen($blob) === 0) return null;

    // Cap at 8MB decoded — a phone photo is typically 1-4MB; this leaves
    // headroom without letting one report eat an unreasonable chunk of
    // a budget host's disk quota.
    if (strlen($blob) > 8 * 1024 * 1024) return null;

    // Verify it's actually a valid, decodable image — not just a file
    // with an image-sounding MIME type claimed by whoever sent the request.
    $imageInfo = @getimagesizefromstring($blob);
    if ($imageInfo === false) return null;

    $subdir = preg_replace('/[^a-z0-9_-]/i', '', $subdir); // defense in depth: never let this build a path outside uploads/
    $uploadDir = PHOTO_UPLOAD_BASE_DIR . '/' . $subdir;
    if (!is_dir($uploadDir)) {
        if (!@mkdir($uploadDir, 0755, true)) return null;
        // Defense in depth: even though we only ever write validated image
        // bytes here, this stops the upload folder from ever executing a
        // script even if something unexpected ends up in it.
        @file_put_contents($uploadDir . '/.htaccess', "php_flag engine off\nOptions -Indexes -ExecCGI\nAddHandler cgi-script .php .php3 .php4 .php5 .phtml .pl .py .jsp .asp .sh .cgi\n");
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    $fullPath = $uploadDir . '/' . $filename;
    if (@file_put_contents($fullPath, $blob) === false) return null;

    return PHOTO_UPLOAD_BASE_URL_PATH . '/' . $subdir . '/' . $filename;
}

// Deletes the photo file on disk for a given stored path (used when an
// incident/facility is deleted, or its photo replaced, so old photo files
// don't pile up forever).
function deletePhotoFile($relativePath) {
    if (empty($relativePath) || !is_string($relativePath)) return;
    if (strpos($relativePath, PHOTO_UPLOAD_BASE_URL_PATH . '/') !== 0) return; // safety: only ever touch our own upload folder
    if (strpos($relativePath, '..') !== false) return; // safety: no path traversal
    $fullPath = __DIR__ . '/../../' . $relativePath;
    if (is_file($fullPath)) @unlink($fullPath);
}
