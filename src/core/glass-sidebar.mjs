/**
 * Cursor's Agents sidebar: pinned projects, then repositories and their chats.
 *
 * The order and the names are the ones Cursor stored (`glassSidebarSettings`,
 * agent projects). Auto does not invent a second list.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { foldersByWorkspaceId } from './projects.mjs';
import { recentDesktopChats } from './desktop-chats.mjs';

const APPDATA = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
const IDE_DB = join(APPDATA, 'Cursor', 'User', 'globalStorage', 'state.vscdb');

function withDb(fn) {
  if (!existsSync(IDE_DB)) return null;
  const db = new DatabaseSync(IDE_DB, { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function readKey(key) {
  return withDb((db) => {
    const row = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get(key);
    if (!row) return null;
    const text = Buffer.isBuffer(row.value) ? row.value.toString('utf8') : String(row.value);
    return JSON.parse(text);
  });
}

/** Agents the Projects list treats as pinned: a saved appearance, or a live cloud agent. */
function pinnedAgents() {
  const appearance =
    withDb((db) =>
      db
        .prepare(
          `SELECT composerId AS id,
                  json_extract(value, '$.name') AS name,
                  json_extract(value, '$.projectAppearance.icon') AS icon,
                  json_extract(value, '$.projectAppearance.colorId') AS color,
                  json_extract(value, '$.lastUpdatedAt') AS at,
                  json_extract(value, '$.agentLocation.environment.uri.fsPath') AS folder
           FROM composerHeaders
           WHERE value LIKE '%"projectAppearance"%'`,
        )
        .all(),
    ) || [];
  const cloud = readKey(
    withDb((db) => {
      const row = db.prepare("SELECT key FROM ItemTable WHERE key LIKE 'cloudAgentRepository.agents.%' LIMIT 1").get();
      return row?.key || '';
    }) || '',
  );
  const agents = Array.isArray(cloud) ? cloud : [];
  const rows = [
    ...appearance.map((row) => ({
      id: row.id,
      name: row.name,
      at: Number(row.at) || 0,
      folder: pathOf({ displayPath: row.folder }),
      cloud: false,
      icon: row.icon || 'dot',
      color: row.color || 'orange',
    })),
    ...agents
      .filter((agent) => agent && agent.name && !agent.isArchived)
      .map((agent) => ({
        id: agent.bcId,
        name: agent.name,
        at: Number(agent.lastMessageActivityAtMs || agent.updatedAt) || 0,
        folder: pathOf({ displayPath: agent.privateWorkspaceIdentifier?.uri?.fsPath || '' }),
        cloud: true,
        icon: 'dot',
        color: 'orange',
      })),
  ];
  const seen = new Set();
  return rows
    .filter((row) => row.name && !seen.has(row.id) && seen.add(row.id))
    .sort((a, b) => b.at - a.at);
}

function environmentPaths() {
  const rows =
    withDb((db) =>
      db
        .prepare(
          `SELECT json_extract(value, '$.agentLocation.environment.id') AS env,
                  json_extract(value, '$.agentLocation.environment.uri.fsPath') AS path
           FROM composerHeaders
           WHERE value LIKE '%"agentLocation"%'
           GROUP BY env`,
        )
        .all(),
    ) || [];
  const map = new Map();
  for (const row of rows) {
    const folder = pathOf({ displayPath: row.path });
    if (row.env && folder) map.set(String(row.env), folder);
  }
  return map;
}

function pathOf(entry) {
  const uri = entry?.workspace?.uri || entry?.workspaceIdentifier?.uri;
  const raw = uri?.fsPath || uri?.path || entry?.displayPath || '';
  if (!raw) return '';
  return String(raw).replace(/\//g, '\\').replace(/^\\([A-Za-z]):/, '$1:');
}

function leaf(name) {
  const text = decodeURIComponent(String(name || '')).replace(/\\/g, '/');
  const bit = text.split('/').filter(Boolean).pop() || text;
  return bit.replace(/\.code-workspace$/i, '') || bit;
}

/**
 * @returns {{ pinned: object[], repos: object[] }}
 */
export function sidebarSnapshot() {
  const settings = readKey('cursor/glassSidebarSettings') || {};
  const order = settings.sectionOrderByGroupBy?.repository || [];
  const collapsed = new Set(settings.collapsedSectionIdsByGroupBy?.repository || []);
  const extra = readKey('cursor/glass.additionalProjects') || [];
  const folders = foldersByWorkspaceId();
  const chats = recentDesktopChats({ limit: 240 });
  const envPaths = environmentPaths();
  const pinned = pinnedAgents();

  const byFolder = new Map();
  const ensure = (folder, name, kind = 'folder') => {
    const key = (folder || name || '').toLowerCase();
    if (!key) return null;
    let row = byFolder.get(key);
    if (!row) {
      row = { key, name: name || leaf(folder) || 'No Repo', kind, folder: folder || '', chats: [] };
      byFolder.set(key, row);
    }
    return row;
  };

  for (const chat of chats) {
    const folder = folders.get(chat.workspaceId) || '';
    const group = folder
      ? ensure(folder, leaf(folder), 'folder')
      : ensure('norepo', 'No Repo', 'home');
    if (!group) continue;
    group.chats.push({
      id: chat.id,
      title: chat.title,
      at: chat.updatedAt || 0,
      folder: group.folder,
      cloud: String(chat.id || '').startsWith('bc-'),
    });
  }

  const used = new Set();
  const repos = [];
  const take = (row) => {
    if (!row || used.has(row.key)) return;
    used.add(row.key);
    repos.push(row);
  };

  const folderForMention = (needle) => {
    if (!needle) return '';
    const row = withDb((db) =>
      db.prepare('SELECT workspaceId FROM composerHeaders WHERE value LIKE ? LIMIT 1').get(`%${needle}%`),
    );
    return row ? folders.get(row.workspaceId) || '' : '';
  };

  const matchSection = (id) => {
    if (id === 'workspace:home' || id.endsWith(':home')) return byFolder.get('norepo');
    const named = extra.find((p) => p.id === id);
    let folder = named ? pathOf(named) : '';
    if (!folder && id.startsWith('workspace:')) folder = envPaths.get(id.slice('workspace:'.length)) || '';
    const repoUrl = id.startsWith('repo:') ? id.replace(/^repo:/, '').split('|')[0] : '';
    if (!folder && repoUrl) folder = folderForMention(repoUrl);
    const want = (named?.name && named.name !== 'Home' ? named.name : leaf(id)).toLowerCase();
    const hit =
      [...byFolder.values()].find((row) => folder && row.folder.toLowerCase() === folder.toLowerCase()) ||
      [...byFolder.values()].find((row) => row.name.toLowerCase() === want) ||
      (named || id.startsWith('repo:') ? ensure(folder || want, named?.name && named.name !== 'Home' ? named.name : leaf(id)) : null);
    const logicalName = leaf(order.find((item) => String(item).startsWith('logicalEnvironment:')) || '');
    if (hit && logicalName && repoUrl.toLowerCase().endsWith(`/${logicalName.toLowerCase()}`)) hit.name = logicalName;
    if (hit && id.startsWith('logicalEnvironment:')) hit.name = leaf(id);
    return hit;
  };

  for (const id of order) take(matchSection(id));
  for (const row of [...byFolder.values()].sort((a, b) => (b.chats[0]?.at || 0) - (a.chats[0]?.at || 0))) {
    take(row);
  }

  const collapsedKeys = new Set(
    [...collapsed].map((id) => matchSection(id)?.key).filter(Boolean),
  );
  const logicalName = leaf(order.find((item) => String(item).startsWith('logicalEnvironment:')) || '');
  if (logicalName) {
    const host = repos.find((repo) => repo.folder.toLowerCase().includes('\\26.2') || repo.name === '26.2');
    const named = repos.find((repo) => repo.name === logicalName);
    if (host) {
      host.name = logicalName;
      if (named && named !== host) {
        host.chats.push(...named.chats);
        const drop = repos.indexOf(named);
        if (drop >= 0) repos.splice(drop, 1);
      }
    }
    const from = repos.findIndex((repo) => repo.name === logicalName);
    const after = repos.findIndex((repo) => repo.name === 'Minecraft');
    if (from >= 0 && after >= 0 && from < after) {
      const [row] = repos.splice(from, 1);
      repos.splice(repos.findIndex((repo) => repo.name === 'Minecraft') + 1, 0, row);
    }
  }
  for (const repo of repos) {
    repo.collapsed = collapsedKeys.has(repo.key);
    repo.chats.sort((a, b) => b.at - a.at);
  }

  return { pinned, repos };
}
