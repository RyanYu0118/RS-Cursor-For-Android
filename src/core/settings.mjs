/**
 * Display settings, kept on the host so every projection agrees.
 *
 * Verbosity is the first one: how much of a turn's tool work a chat shows.
 * It is not per session and not per browser — the phone, the web tab, and the
 * next client to connect should all read the same answer, so it lives in
 * `state/settings.json` and is broadcast when it changes. A browser's
 * localStorage only ever holds what is private to that browser (theme, rail).
 *
 *   quiet   — a summary line per turn, no individual tools
 *   normal  — activity lines, edits, commands (the default)
 *   verbose — everything, including hidden tools and raw JSON
 */
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const VERBOSITY = ['quiet', 'normal', 'verbose'];
export const DEFAULT_VERBOSITY = 'normal';

export class DisplaySettings extends EventEmitter {
  constructor(stateDir) {
    super();
    this.path = join(stateDir, 'settings.json');
    this.verbosity = DEFAULT_VERBOSITY;
    this.#load();
  }

  /** What a client is told on connect, and after every change. */
  get() {
    return { verbosity: this.verbosity };
  }

  setVerbosity(level) {
    const next = String(level || '').toLowerCase();
    if (!VERBOSITY.includes(next)) throw new Error(`Unknown verbosity "${level}"`);
    if (next === this.verbosity) return this.get();
    this.verbosity = next;
    this.#persist();
    const snapshot = this.get();
    this.emit('change', snapshot);
    return snapshot;
  }

  #load() {
    if (!existsSync(this.path)) return;
    try {
      const raw = JSON.parse(readFileSync(this.path, 'utf8'));
      if (VERBOSITY.includes(raw.verbosity)) this.verbosity = raw.verbosity;
    } catch {
      /* an unreadable file is no setting, not a crash */
    }
  }

  #persist() {
    // Write-then-rename so a crash mid-write cannot leave a truncated file.
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(
      tmp,
      JSON.stringify({ verbosity: this.verbosity, updatedAt: new Date().toISOString() }) + '\n',
    );
    renameSync(tmp, this.path);
  }
}