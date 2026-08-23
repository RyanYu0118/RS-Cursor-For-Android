/**
 * The Windows clipboard, because it is the only door into Cursor's chat box that
 * takes a picture.
 *
 * Cursor attaches an image when one is pasted, and there is no protocol command
 * for "attach this file" — the debug port can ask a page to *paste*, but what it
 * pastes is whatever the machine is holding. So sending a photo from a phone
 * means putting it on this machine's clipboard for a moment.
 *
 * That is somebody else's clipboard, so it is borrowed rather than taken: any
 * text on it is read first and put back afterwards. Text is all that can be
 * restored — an image or a copied file cannot be read back out and returned — so
 * an attachment costs whoever is sitting at this machine whatever picture they
 * had copied. It is worth saying out loud, and it is why nothing here runs
 * unless an image is actually being sent.
 *
 * Windows only, like the rest of Auto's desktop half.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Long enough for PowerShell to start; it is the slow part, not the clipboard. */
const SHELL_TIMEOUT_MS = 15_000;
/** SetImage often fails once when another app briefly holds the clipboard. */
const CLIP_TRIES = 6;
const CLIP_RETRY_MS = 50;

/** One clipboard user at a time — concurrent sends were racing each other. */
let gate = Promise.resolve();

function queued(fn) {
  const next = gate.then(() => fn(), () => fn());
  gate = next.catch(() => {});
  return next;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an async function a few times before giving up.
 * @internal exported for tests
 */
export async function retryAsync(fn, { tries = CLIP_TRIES, delayMs = CLIP_RETRY_MS } = {}) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i < tries - 1) await sleep(delayMs * (i + 1));
    }
  }
  throw last;
}

function powershell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Sta', '-Command', script],
      { timeout: SHELL_TIMEOUT_MS, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) reject(new Error(clipError(String(stderr || err.message).trim())));
        else resolve(String(stdout));
      },
    );
  });
}

/** Turn a PowerShell stack trace into something worth showing on a phone. */
function clipError(msg) {
  if (/clipboard operation did not succeed/i.test(msg)) return 'the clipboard was busy';
  const line = String(msg).split(/\r?\n/).find((l) => l.trim()) || msg;
  return line
    .replace(/^Exception calling "[^"]+"[^:]*:\s*"?/, '')
    .replace(/"\s*$/, '')
    .trim() || 'clipboard failed';
}

/** Whatever text is on the clipboard, so it can be put back. */
export async function takeText() {
  return queued(async () => {
    try {
      const out = await powershell('Get-Clipboard -Raw');
      return out.replace(/\r?\n$/, '');
    } catch {
      return '';
    }
  });
}

/** Put text back, or empty the clipboard if there was none. */
export async function putText(text) {
  return queued(async () => {
    const body = String(text ?? '');
    const script = body
      ? `Set-Clipboard -Value ([System.Text.Encoding]::UTF8.GetString(` +
        `[System.Convert]::FromBase64String('${Buffer.from(body, 'utf8').toString('base64')}')))`
      : 'Set-Clipboard -Value $null';
    await powershell(script).catch(() => {});
  });
}

/**
 * Put an image on the clipboard, as a picture rather than as a file.
 *
 * A copied *file* pastes as a path in some places and an attachment in others;
 * a picture pastes as a picture everywhere, which is what Cursor wants.
 *
 * @param {Buffer} bytes  the image itself, in any format .NET can read
 */
export async function putImage(bytes) {
  return queued(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'auto-clip-'));
    const file = join(dir, 'image');
    try {
      await writeFile(file, bytes);
      await powershell(
        `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ` +
          `$img = [System.Drawing.Image]::FromFile(${quote(file)}); ` +
          `try { ` +
          `$ok = $false; ` +
          `for ($try = 0; $try -lt ${CLIP_TRIES} -and -not $ok; $try++) { ` +
          `  try { ` +
          `    if ($try -gt 0) { Start-Sleep -Milliseconds (${CLIP_RETRY_MS} * $try) }; ` +
          `    [System.Windows.Forms.Clipboard]::Clear(); ` +
          `    [System.Windows.Forms.Clipboard]::SetImage($img); ` +
          `    $ok = [System.Windows.Forms.Clipboard]::ContainsImage(); ` +
          `  } catch { if ($try -eq ${CLIP_TRIES - 1}) { throw } } ` +
          `}; ` +
          `if (-not $ok) { throw 'the clipboard would not take the image' } ` +
          `} finally { $img.Dispose() }`,
      );
      return true;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
}

/** A path PowerShell will read as one string, whatever is in it. */
function quote(path) {
  return `'${String(path).replace(/'/g, "''")}'`;
}
