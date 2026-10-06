/**
 * Cursor's own icon set, for drawing a chat's icon the way its sidebar does.
 *
 * The Agents window draws icons from the `cursor-icons` font with a glyph
 * per name. Both halves ship in the install: the font as
 * `out/media/cursor-icons-16.woff2`, and the name → glyph table inside
 * `workbench.glass.main.js` — names front-coded (each keeps a base-36 count
 * of the previous name's characters), glyphs as base-36 code-point deltas in
 * the same order. Nothing is copied into this repo; both are read from the
 * Cursor that is installed, so an update brings its icons along.
 *
 * Phones cannot load WOFF2, so the font is served as TrueType, converted once
 * per installed font and kept under `state/`.
 */
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { findCursorExe } from './cursor-launch.mjs';

const BUNDLE = ['resources', 'app', 'out', 'vs', 'workbench', 'workbench.glass.main.js'];
const FONT = ['resources', 'app', 'out', 'media', 'cursor-icons-16.woff2'];

let installDir;
function cursorDir() {
  if (installDir !== undefined) return installDir;
  try {
    const exe = findCursorExe();
    installDir = exe ? dirname(exe) : null;
  } catch {
    installDir = null;
  }
  return installDir;
}

/**
 * Decode the name → glyph table from the bundle source.
 * @returns {Map<string, string>|null}  icon name → one-character string
 */
export function decodeIconGlyphs(source) {
  const nameFn = /function (\w+)\(t\)\{const e=\[\];let n="";for\(const i of t\.split\(" "\)\)n=n\.slice\(0,Number\.parseInt\(i\[0\],36\)\)\+i\.slice\(1\),e\.push\(n\)/.exec(source);
  const glyphFn = /function (\w+)\(t\)\{const e=\[\];let n=0;for\(const i of t\.split\(" "\)\)n\+=Number\.parseInt\(i,36\),e\.push\(String\.fromCharCode\(n\)\)/.exec(source);
  if (!nameFn || !glyphFn) return null;
  const namesVar = new RegExp(`[,;\\s](\\w+)=${nameFn[1]}\\((\\w+)\\)`).exec(source);
  if (!namesVar) return null;
  // The outline table: glyphs decoded and laid over the names, index for index.
  const tableFn = new RegExp(
    `function \\w+\\(\\)\\{const t=${glyphFn[1]}\\((\\w+)\\),e=\\{\\};for\\(let n=0;n<${namesVar[1]}\\.length;n\\+\\+\\)`,
  ).exec(source);
  if (!tableFn) return null;
  const literal = (name) => new RegExp(`[,;\\s]${name}="([^"]*)"`).exec(source)?.[1];
  const namesText = literal(namesVar[2]);
  const glyphText = literal(tableFn[1]);
  if (!namesText || !glyphText) return null;

  const names = [];
  let prev = '';
  for (const part of namesText.split(' ')) {
    prev = prev.slice(0, Number.parseInt(part[0], 36)) + part.slice(1);
    names.push(prev);
  }
  const glyphs = new Map();
  let code = 0;
  const deltas = glyphText.split(' ');
  for (let i = 0; i < names.length && i < deltas.length; i += 1) {
    code += Number.parseInt(deltas[i], 36);
    glyphs.set(names[i], String.fromCharCode(code));
  }
  return glyphs.size ? glyphs : null;
}

let glyphCache = null;

/** The glyph for an icon name, or '' when Cursor has no such icon or is not installed. */
export function iconGlyph(name) {
  if (!name) return '';
  if (glyphCache === null) {
    glyphCache = new Map();
    const dir = cursorDir();
    const file = dir && join(dir, ...BUNDLE);
    if (file && existsSync(file)) {
      try {
        glyphCache = decodeIconGlyphs(readFileSync(file, 'utf8')) || new Map();
      } catch {
        glyphCache = new Map();
      }
    }
  }
  return glyphCache.get(String(name)) || '';
}

let fontCache = null;

/**
 * Cursor's icon font as TrueType, converted from the installed WOFF2 and
 * cached beside the host's other state. Keyed by the source's size and time,
 * so a Cursor update re-converts.
 *
 * @returns {Promise<{ body: Buffer, etag: string }|null>}
 */
export async function iconFontTtf(stateDir) {
  const dir = cursorDir();
  const src = dir && join(dir, ...FONT);
  if (!src || !existsSync(src)) return null;
  const st = statSync(src);
  const etag = `"ci-${st.size}-${Math.floor(st.mtimeMs)}"`;
  if (fontCache?.etag === etag) return fontCache;
  const out = join(stateDir, 'cursor-icons.ttf');
  const stamp = join(stateDir, 'cursor-icons.etag');
  try {
    if (existsSync(out) && existsSync(stamp) && readFileSync(stamp, 'utf8') === etag) {
      fontCache = { body: readFileSync(out), etag };
      return fontCache;
    }
  } catch {
    // Re-convert below.
  }
  const mod = await import('wawoff2');
  const decompress = mod.decompress || mod.default?.decompress;
  const body = Buffer.from(await decompress(readFileSync(src)));
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(out, body);
    writeFileSync(stamp, etag);
  } catch {
    // Serving from memory is fine; the cache is an optimisation.
  }
  fontCache = { body, etag };
  return fontCache;
}
