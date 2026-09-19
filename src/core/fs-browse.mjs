/**
 * Browsing the machine's folders, so a session can be started somewhere the
 * IDE has never opened. The project list is Cursor's; this is the escape
 * hatch for everything else, and it has to work on a phone where there is no
 * file picker worth using.
 *
 * Async on purpose: probing drive letters and reading a directory can block on
 * a slow or unready volume, and the host must not stall on someone else's
 * filesystem. Nothing here touches the agent — it is local and read-only.
 */
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';

/** Folders we never offer: not projects, and a hazard to read by accident. */
const SKIP = new Set(['node_modules', '$RECYCLE.BIN', 'System Volume Information']);
const PROBE_MS = 300;

/** `access` that gives up on a volume that will not answer. */
async function reachable(path) {
  let timer;
  try {
    return await Promise.race([
      stat(path).then(() => true).catch(() => false),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), PROBE_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The roots a browser starts from: drives on Windows, `/` elsewhere. */
async function listRoots() {
  const letters = [];
  if (process.platform === 'win32') {
    for (let c = 65; c <= 90; c += 1) letters.push(`${String.fromCharCode(c)}:\\`);
  } else {
    letters.push('/');
  }
  const found = (await Promise.all(letters.map((p) => reachable(p).then((ok) => (ok ? p : null))))).filter(
    Boolean,
  );
  const roots = found.map((path) => ({ name: path, path }));
  const home = homedir();
  if (home && (await reachable(home))) roots.unshift({ name: 'Home', path: home, home: true });
  return roots;
}

const isHidden = (name) => name.startsWith('.');

/**
 * What is under one folder, or the roots when none is named.
 *
 * @param {string} [target] absolute folder to look in; empty means the roots
 * @returns {Promise<object>} `{path, parent, entries, roots, home}`
 */
export async function listDirectories(target) {
  const wanted = String(target || '').trim();
  const roots = await listRoots();

  if (!wanted) {
    return { path: null, parent: null, entries: roots, roots, home: homedir() };
  }

  const dir = resolve(wanted);
  let info;
  try {
    info = await stat(dir);
  } catch {
    throw new Error(`No such folder: ${dir}`);
  }
  if (!info.isDirectory()) throw new Error(`Not a folder: ${dir}`);

  let dirents = [];
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read ${dir}: ${err.message}`);
  }

  const entries = dirents
    .filter((e) => e.isDirectory() && !SKIP.has(e.name) && !isHidden(e.name))
    .map((e) => ({ name: e.name, path: join(dir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const parent = parse(dir).root === dir ? null : dirname(dir);
  return { path: dir, parent, entries, roots, home: homedir() };
}
