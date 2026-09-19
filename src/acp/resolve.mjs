/**
 * Locate the agent CLI Auto drives over ACP.
 *
 * Two agents speak the same protocol: Cursor's `cursor-agent acp` and
 * `opencode acp`. Each resolver returns the exact command to spawn — the
 * Cursor entry points on Windows are PowerShell shims that re-exec a bundled
 * node, so we resolve past them to the real `node.exe index.js` and nothing
 * sits between us and the agent's stdio on the protocol path.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const VERSION_DIR_RE = /^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:-\d{2}-\d{2}-\d{2})?-[a-f0-9]+$/;

/** Sortable integer for a version directory name, or null if unrecognised. */
function versionRank(name) {
  const m = VERSION_DIR_RE.exec(name);
  if (!m) return null;
  const [, y, mo, d] = m;
  return Number(`${y}${mo.padStart(2, '0')}${d.padStart(2, '0')}`);
}

/** Base install directory for the Cursor Agent CLI. */
export function agentHome() {
  if (process.env.CURSOR_AGENT_HOME) return process.env.CURSOR_AGENT_HOME;
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA || '', 'cursor-agent');
  }
  return join(process.env.HOME || '', '.local', 'share', 'cursor-agent');
}

/**
 * @returns {{ command: string, args: string[], shell: boolean, via: string }}
 * @throws if no usable CLI is found.
 */
export function resolveCursorAgent() {
  const base = agentHome();
  const versions = join(base, 'versions');

  if (existsSync(versions)) {
    // Note: on Windows this directory is hidden; readdirSync sees it fine.
    const ranked = readdirSync(versions)
      .map((name) => ({ name, rank: versionRank(name) }))
      .filter((v) => v.rank !== null)
      .sort((a, b) => a.rank - b.rank);

    for (const { name } of ranked.reverse()) {
      const nodeBin = join(versions, name, process.platform === 'win32' ? 'node.exe' : 'node');
      const index = join(versions, name, 'index.js');
      if (existsSync(nodeBin) && existsSync(index)) {
        return { command: nodeBin, args: [index], shell: false, via: name };
      }
    }
  }

  const shim = join(base, process.platform === 'win32' ? 'cursor-agent.cmd' : 'cursor-agent');
  if (existsSync(shim)) {
    return { command: shim, args: [], shell: process.platform === 'win32', via: 'shim' };
  }

  throw new Error(
    `Cursor Agent CLI not found under ${base}. Install it with:\n` +
      `  irm 'https://cursor.com/install?win32=true' | iex\n` +
      `then run: cursor-agent login`,
  );
}

/**
 * The two agents Auto knows how to drive over ACP.
 *
 * `cursor` is the historical default; `opencode` is an alternative agent for
 * sessions that do not live in the Cursor window. A session records which one
 * it uses, so a restart resumes the same conversation with the same CLI.
 */
export const AGENTS = ['cursor', 'opencode'];

/** Agent names acceptable to `resolveAgent` / a session's `agent` field. */
export function isAgentName(name) {
  return AGENTS.includes(String(name || ''));
}

/** Windows only: an `.cmd` / `.bat` entry point needs a shell to execute. */
function shellFor(command) {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
}

/**
 * Locate the opencode CLI.
 *
 * chocolatey installs `opencode.exe` (a bun shim — a real binary, so spawned
 * directly). npm installs an `opencode.cmd` shim on Windows. Either is found
 * by walking `PATH`, and `OPENCODE_BIN` overrides it for a non-standard
 * install.
 */
export function resolveOpencode() {
  const override = process.env.OPENCODE_BIN;
  if (override) {
    if (existsSync(override)) {
      return { command: override, args: [], shell: shellFor(override), via: 'OPENCODE_BIN' };
    }
    throw new Error(`OPENCODE_BIN points at nothing: ${override}`);
  }

  const names = process.platform === 'win32' ? ['opencode.exe', 'opencode.cmd', 'opencode'] : ['opencode'];
  for (const dir of String(process.env.PATH || '').split(delimiter)) {
    // PATH entries are sometimes quoted; a quoted directory is not a path.
    const clean = dir.replace(/^"(.*)"$/, '$1').trim();
    if (!clean) continue;
    for (const name of names) {
      const candidate = join(clean, name);
      try {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          return { command: candidate, args: [], shell: shellFor(candidate), via: 'PATH' };
        }
      } catch {
        /* an unreadable PATH entry is not an error */
      }
    }
  }

  throw new Error(
    `opencode CLI not found on PATH. Install it with:\n` +
      `  npm i -g opencode-ai\n` +
      `or point OPENCODE_BIN at the executable.`,
  );
}

/**
 * Resolve the CLI for an agent by name.
 *
 * @param {'cursor'|'opencode'|string} [name]
 * @returns {{ name: string, command: string, args: string[], shell: boolean, via: string }}
 * @throws if the agent is unknown or its CLI is not installed.
 */
export function resolveAgent(name = 'cursor') {
  if (name === 'opencode') return { name: 'opencode', ...resolveOpencode() };
  if (name === 'cursor' || !name) return { name: 'cursor', ...resolveCursorAgent() };
  throw new Error(`Unknown agent "${name}" (expected one of: ${AGENTS.join(', ')})`);
}

/** Whether an agent's CLI can be found right now; never throws. */
export function agentAvailable(name) {
  try {
    resolveAgent(name);
    return true;
  } catch {
    return false;
  }
}
