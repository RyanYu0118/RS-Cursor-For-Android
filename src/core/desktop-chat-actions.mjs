/**
 * Pin / unpin / archive a Cursor desktop chat by rewriting its
 * `composerHeaders` row — the same fields Agents uses for Pinned.
 *
 * Brief write-then-close against state.vscdb (same pattern as the desktop
 * bridge gate). Cursor may keep reading the old row until it refreshes;
 * Auto re-reads the sidebar after each action.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APPDATA = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
const IDE_DB = join(APPDATA, 'Cursor', 'User', 'globalStorage', 'state.vscdb');

const PIN_COLORS = ['orange', 'green', 'blue', 'purple', 'red', 'yellow'];
const PIN_ICONS = ['dot', 'buildings', 'arrows-out-cardinal', 'sparkle'];

function withDb(readOnly, fn) {
  if (!existsSync(IDE_DB)) throw new Error('Cursor chat database not found');
  const db = new DatabaseSync(IDE_DB, { readOnly });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function textOf(row, column = 'value') {
  const v = row[column];
  return Buffer.isBuffer(v) ? Buffer.from(v).toString('utf8') : String(v ?? '');
}

function readHeader(db, composerId) {
  const row = db
    .prepare(
      'SELECT composerId, workspaceId, value, isArchived FROM composerHeaders WHERE composerId = ?',
    )
    .get(composerId);
  if (!row) return null;
  let head = {};
  try {
    head = JSON.parse(textOf(row));
  } catch {
    /* keep empty */
  }
  return { row, head };
}

function writeHeader(db, composerId, head, { isArchived } = {}) {
  const value = JSON.stringify(head);
  if (typeof isArchived === 'number') {
    db.prepare(
      'UPDATE composerHeaders SET value = ?, isArchived = ?, lastUpdatedAt = ? WHERE composerId = ?',
    ).run(value, isArchived, Date.now(), composerId);
  } else {
    db.prepare(
      'UPDATE composerHeaders SET value = ?, lastUpdatedAt = ? WHERE composerId = ?',
    ).run(value, Date.now(), composerId);
  }
}

function pickAppearance(name = '') {
  let n = 0;
  for (const ch of String(name)) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  return {
    icon: PIN_ICONS[n % PIN_ICONS.length],
    colorId: PIN_COLORS[n % PIN_COLORS.length],
  };
}

/** Is this composer currently treated as a pinned Agents project? */
export function isComposerPinned(composerId) {
  if (!composerId || !existsSync(IDE_DB)) return false;
  return withDb(true, (db) => {
    const found = readHeader(db, composerId);
    if (!found) return false;
    return Boolean(found.head.projectAppearance) || found.head.isProject === true || found.head.isProject === 1;
  });
}

/**
 * Pin a desktop chat into Agents' Pinned list.
 * @returns {{ ok: true, pinned: true, id: string, name: string, color: string }}
 */
export function pinComposer(composerId) {
  if (!composerId) throw new Error('composerId required');
  return withDb(false, (db) => {
    const found = readHeader(db, composerId);
    if (!found) throw new Error(`chat ${composerId} not found`);
    const { head } = found;
    const appearance = head.projectAppearance?.colorId
      ? head.projectAppearance
      : pickAppearance(head.name || composerId);
    head.projectAppearance = {
      icon: appearance.icon || 'dot',
      colorId: appearance.colorId || 'orange',
    };
    head.isProject = true;
    writeHeader(db, composerId, head);
    return {
      ok: true,
      pinned: true,
      id: composerId,
      name: head.name || 'project',
      color: head.projectAppearance.colorId,
    };
  });
}

/**
 * Remove a chat from Agents' Pinned list.
 * @returns {{ ok: true, pinned: false, id: string }}
 */
export function unpinComposer(composerId) {
  if (!composerId) throw new Error('composerId required');
  return withDb(false, (db) => {
    const found = readHeader(db, composerId);
    if (!found) throw new Error(`chat ${composerId} not found`);
    const { head } = found;
    delete head.projectAppearance;
    head.isProject = false;
    writeHeader(db, composerId, head);
    return { ok: true, pinned: false, id: composerId };
  });
}

/**
 * Archive a desktop chat in Cursor (and hide it from Agents).
 * @returns {{ ok: true, archived: true, id: string }}
 */
export function archiveComposer(composerId) {
  if (!composerId) throw new Error('composerId required');
  return withDb(false, (db) => {
    const found = readHeader(db, composerId);
    if (!found) throw new Error(`chat ${composerId} not found`);
    const { head } = found;
    head.isArchived = true;
    delete head.projectAppearance;
    head.isProject = false;
    writeHeader(db, composerId, head, { isArchived: 1 });
    return { ok: true, archived: true, id: composerId };
  });
}
