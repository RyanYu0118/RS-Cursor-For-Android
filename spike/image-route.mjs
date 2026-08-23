/**
 * What `/api/image` will and will not hand over.
 *
 * The route is a file read reachable over Tailscale, so the interesting part
 * is everything it refuses. Point it at a dev host (`npm run dev`, port 4340)
 * rather than the live one.
 *
 * Usage: node spike/image-route.mjs [port]
 */
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.argv[2] || 4340;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const outside = join(tmpdir(), 'auto-image-probe.png');
writeFileSync(outside, Buffer.from('89504e470d0a1a0a', 'hex'));
const inCursorTemp = join(tmpdir(), 'cursor', 'auto-image-probe.png');

const ask = async (path, label) => {
  const url = `http://127.0.0.1:${PORT}/api/image?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const body = res.ok ? `${(await res.arrayBuffer()).byteLength} bytes` : (await res.text()).trim();
  console.log(
    `${String(res.status).padEnd(4)} ${res.headers.get('content-type') || '-'}`.padEnd(26) +
      `${label.padEnd(34)} ${body}`,
  );
};

console.log('status  content-type          what                               body');
await ask('src/web/icon-192.png', 'relative, inside the folder');
await ask(join(ROOT, 'src', 'web', 'icon-512.png'), 'absolute, inside the folder');
await ask(outside, 'a png outside every root');
await ask(join(ROOT, '..', basename(outside)), 'a path climbing out with ..');
await ask(join(ROOT, 'package.json'), 'not an image');
await ask(join(ROOT, 'src', 'web', 'icon.svg'), 'an SVG (a script document)');
await ask(join(ROOT, 'src', 'web', 'nope.png'), 'inside the folder but absent');
await ask(inCursorTemp, "Cursor's screenshot folder (may be absent)");
await ask('', 'no path at all');

rmSync(outside, { force: true });
