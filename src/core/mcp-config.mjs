/**
 * MCP servers Cursor has on disk — user + workspace mcp.json.
 * The tablet + menu lists these; the agent uses them inside Cursor.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function readServers(file, source) {
  if (!existsSync(file)) return [];
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
  const map = data?.mcpServers;
  if (!map || typeof map !== 'object') return [];
  return Object.keys(map)
    .filter((name) => name && typeof name === 'string')
    .map((name) => ({
      name,
      source,
      disabled: Boolean(map[name]?.disabled),
    }));
}

/**
 * @param {{ folder?: string|null }} [opts]
 * @returns {{ name: string, source: string, disabled: boolean }[]}
 */
export function listMcpServers({ folder } = {}) {
  const byName = new Map();
  const home = join(homedir(), '.cursor', 'mcp.json');
  for (const row of readServers(home, 'user')) byName.set(row.name, row);
  if (folder) {
    for (const row of readServers(join(folder, '.cursor', 'mcp.json'), 'workspace')) {
      byName.set(row.name, row);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
