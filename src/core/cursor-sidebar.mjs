/**
 * Cursor's Agents sidebar, read and changed through the Agents window's own
 * services over the debug port — never by pressing its UI.
 *
 * Pressing the row menu worked, but it opened menus on the computer's screen
 * and needed the window in front; Cursor had to stay visible for a phone to
 * pin a chat. The menu's handlers are thin wrappers over services the
 * workbench already holds (`cloudAgentRepositoryService` for pins,
 * `agentRepositoryService` for archive / unread / fork, `composerDataService`
 * and `composerService` for names and icons, `glassAgentMigrationService` for
 * Move to), so Auto calls those directly: nothing is clicked, nothing comes
 * forward, and Cursor can sit minimised.
 *
 * Services are looked up by their registered id, not by Cursor's minified
 * class names. What each action does mirrors the sidebar's own handler for
 * it, including the persistence steps a rename or icon change needs.
 */
import { readFileSync } from 'node:fs';
import { CursorCdp, DEFAULT_PORT } from './cursor-cdp.mjs';
import { iconGlyph } from './cursor-icons.mjs';

const cdps = new Map();
function cdpFor(port) {
  if (!cdps.has(port)) cdps.set(port, new CursorCdp({ port }));
  return cdps.get(port);
}

/**
 * The in-page half: find the services, then run one action. `op` and `args`
 * are spliced in as JSON. Answers `{ status: 'no-services' }` in a window
 * without the Agents services so the next window gets the turn.
 */
function agentScript(op, args = {}) {
  return `(async () => {
    const op = ${JSON.stringify(op)};
    const a = ${JSON.stringify(args)};
    const entries = globalThis.__autoData?._instantiationService?._services?._entries;
    if (!entries || typeof entries[Symbol.iterator] !== 'function') return { status: 'no-services' };
    const svc = {};
    for (const [id, v] of entries) {
      const o = v && (v._instance || v.instance || v);
      if (!o || typeof o !== 'object') continue;
      try { svc[String(id)] = o; } catch {}
    }
    const repo = svc.agentRepositoryService;
    const pins = svc.cloudAgentRepositoryService;
    const data = svc.composerDataService;
    if (typeof repo?.getAgentHeader !== 'function' || typeof pins?.pinAgent !== 'function') {
      return { status: 'no-services' };
    }
    const val = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);
    const pinnedIds = () => [...(pins.pinnedAgentIds?.get?.() ?? pins._pinnedAgentIds?.value ?? [])];
    const release = (ref) => { try { ref?.dispose?.(); } catch {} };
    const withLoaded = (id, fn) => { const ref = repo.getAgent?.(id); try { return fn(ref); } finally { release(ref); } };

    if (op === 'pinned') {
      // What the Pinned group draws: pins that still have a header, newest first.
      return {
        ok: true,
        pinned: pinnedIds()
          .map((id) => repo.getAgentHeader(id))
          .filter((h) => h && !val(h.isArchived))
          .sort((x, y) => (val(y.lastUpdatedAt) || 0) - (val(x.lastUpdatedAt) || 0))
          .map((h) => ({ id: h.id, name: String(val(h.name) || '').trim() })),
      };
    }

    const h = repo.getAgentHeader(a.id);
    if (!h) return { ok: false, reason: 'not-found' };

    if (op === 'pin') { pins.pinAgent(a.id); return { ok: pinnedIds().includes(a.id) }; }
    if (op === 'unpin') { pins.unpinAgent(a.id); return { ok: !pinnedIds().includes(a.id) }; }

    if (op === 'archive') {
      await repo.archiveAgent(a.id, { closePullRequest: false, cleanupWorktrees: true });
      pins.removeArchivedPinnedAgentIds?.([a.id]);
      return { ok: true };
    }

    if (op === 'unread') {
      const unread = Boolean(val(h.hasUnreadMessages));
      if (unread) await repo.markAgentRead(a.id);
      else await repo.markAgentUnread(a.id);
      return { ok: true, unread: !unread };
    }

    if (op === 'fork') {
      const ref = await repo.duplicateAgent(a.id);
      const id = ref?.header?.id;
      release(ref);
      return id ? { ok: true, id } : { ok: false, reason: 'failed' };
    }

    if (op === 'rename') {
      const name = String(a.title || '');
      if (h.source === 'cloud') {
        const done = await pins.renameCloudAgent({ agentId: a.id, newName: name });
        return done ? { ok: true } : { ok: false, reason: 'failed' };
      }
      if (h.source !== 'local') return { ok: false, reason: 'unsupported' };
      const before = String(val(h.name) || '');
      const apply = (value) => {
        h.name?.set?.(value);
        withLoaded(a.id, (ref) => {
          if (ref && ref.header !== h) ref.header?.name?.set?.(value);
          ref?.composerDataHandle?.setData('name', value);
        });
        data.setAllComposersData('allComposers', (c) => c.composerId === a.id, { name: value });
      };
      apply(name);
      try {
        const host = svc.cursorAgentHostEnablementService?.isCursorAgentHostEnabled?.() === true;
        if (host && typeof svc.agentHostProviderService?.setSessionTitle === 'function') {
          await svc.agentHostProviderService.setSessionTitle({ sessionId: a.id, title: name });
        } else {
          await svc.composerService.renameComposer(a.id, name, { throwOnFailure: true });
          await data.manuallyPersistComposerOrThrow(a.id);
          await data.saveComposers();
        }
      } catch (err) {
        apply(before);
        return { ok: false, reason: 'failed', error: String(err?.message || err) };
      }
      return { ok: true };
    }

    if (op === 'appearance') {
      const current = val(h.projectAppearance) || null;
      if (!('appearance' in a)) return { ok: true, current };
      const next = a.appearance || undefined;
      if (h.source === 'cloud') {
        if (next) pins.updateCloudAgentAppearance(a.id, next);
        else pins.clearCloudAgentAppearance(a.id);
        return { ok: true, current: next || null };
      }
      if (h.source !== 'local') return { ok: false, reason: 'unsupported' };
      h.projectAppearance?.set?.(next);
      withLoaded(a.id, (ref) => ref?.composerDataHandle?.setData('projectAppearance', next));
      await data.updateComposerDataAsync(a.id, (set) => set('projectAppearance', next));
      data.setAllComposersData('allComposers', (c) => c.composerId === a.id, { projectAppearance: next });
      await data.saveComposers();
      return { ok: true, current: next || null };
    }

    if (op === 'move-targets' || op === 'move') {
      const mig = svc.glassAgentMigrationService;
      if (typeof mig?.getMigrationTargetsForAgent !== 'function') return { ok: false, reason: 'unsupported' };
      const list = mig.getMigrationTargetsForAgent(h) || [];
      if (op === 'move-targets') {
        return {
          ok: true,
          items: list.map((t) => ({ id: t.id, label: t.label || t.id, detail: t.description || '', sub: false,
            disabled: Boolean(t.disabled || t.disabledReason) })),
        };
      }
      const want = String(a.target || '');
      const target =
        list.find((t) => t.id === want) ||
        list.find((t) => ((t.label || '') + ' ' + (t.description || '')).trim() === want) ||
        list.find((t) => t.label === want);
      if (!target) return { ok: false, reason: 'no-item', words: list.map((t) => t.label) };
      await mig.migrateAgent({ sourceAgentId: a.id, targetEnvironment: target.environment,
        targetLabel: target.label, entrypoint: 'sidebar_move_to_menu' });
      return { ok: true, label: target.label };
    }

    if (op === 'copy') {
      if (a.target === 'agent-id') return { ok: true, text: a.id };
      if (a.target === 'branch') {
        const names = [...new Set((val(h.trackedGitRepos) || [])
          .map((r) => String(val(r.activeBranchName) || '').trim()).filter(Boolean))];
        return names.length ? { ok: true, text: names.join(', ') } : { ok: false, reason: 'no-item', words: ['Copy Branch'] };
      }
      if (a.target === 'transcript') {
        const ref = repo.getAgent?.(a.id) ?? (await repo.loadAgent(a.id));
        try {
          const heads = ref.composerDataHandle.data.fullConversationHeadersOnly ?? [];
          await ref.ensureConversationBodies?.(heads.map((x) => x.bubbleId));
          const d = ref.composerDataHandle.data;
          const out = [];
          const title = String(d.name || '').trim();
          if (title) out.push('# ' + title + '\\n\\n');
          for (const x of d.fullConversationHeadersOnly ?? []) {
            const b = d.conversationMap?.[x.bubbleId];
            const text = String(b?.text || '').trim();
            const type = b?.type ?? x.type;
            if (!text || (type !== 1 && type !== 2)) continue;
            out.push('## ' + (type === 1 ? 'User' : 'Assistant') + '\\n\\n' + text + '\\n\\n');
          }
          return { ok: true, text: out.join('').trimEnd() };
        } finally {
          release(ref);
        }
      }
      return { ok: false, reason: 'no-item', words: ['Copy Agent ID', 'Copy Branch', 'Copy Transcript'] };
    }

    return { ok: false, reason: 'unsupported' };
  })()`;
}

/** Run one action in the Agents window. `no-cdp` when no window could. */
async function run(op, args, port = DEFAULT_PORT) {
  const res = await cdpFor(port).inAgentsWindow(agentScript(op, args));
  if (res && typeof res.ok === 'boolean') return res;
  return { ok: false, reason: 'no-cdp', error: res?.reason };
}

function checkId(chatId) {
  if (!/^[\w-]+$/.test(String(chatId || ''))) throw new Error('chatId required');
}

/**
 * The Pinned group as the window draws it, in its order.
 * @returns {Promise<{id: string, name: string}[] | null>} null when no window answers
 */
export async function readLivePinned({ port = DEFAULT_PORT } = {}) {
  const res = await run('pinned', {}, port);
  return res.ok ? res.pinned : null;
}

export const ROW_ACTIONS = ['pin', 'unpin', 'archive', 'unread', 'fork', 'move', 'copy'];
export const COPY_ITEMS = { 'agent-id': 'Copy Agent ID', branch: 'Copy Branch', transcript: 'Copy Transcript' };

/**
 * Do a row action through Cursor's services.
 * @param {string} action  one of ROW_ACTIONS; `move` / `copy` take `target`
 * @returns {Promise<{ ok: boolean, reason?: string, words?: string[], text?: string, id?: string }>}
 *   reason `no-cdp` when no window answered at all.
 */
export async function pressSidebarAction(chatId, action, { port = DEFAULT_PORT, target = '' } = {}) {
  checkId(chatId);
  if (!ROW_ACTIONS.includes(action)) throw new Error(`Unknown sidebar action ${action}`);
  return run(action, { id: chatId, target: String(target || '') }, port);
}

/**
 * What a row's menu offers. Only "Move to" varies by chat; the rest is
 * Cursor's fixed list, answered here without asking the window.
 */
export async function readRowMenu(chatId, { sub = '', port = DEFAULT_PORT } = {}) {
  checkId(chatId);
  if (/^move/i.test(sub)) return run('move-targets', { id: chatId }, port);
  if (/^copy/i.test(sub)) {
    return { ok: true, items: Object.values(COPY_ITEMS).map((label) => ({ label, detail: '', sub: false, disabled: false })) };
  }
  const items = ['Pin', 'Rename', 'Edit Icon', 'Mark as Unread', 'Fork', 'Move to', 'Copy', 'Archive'];
  return { ok: true, items: items.map((label) => ({ label, detail: '', sub: label === 'Move to' || label === 'Copy', disabled: false })) };
}

export async function renameRow(chatId, title, { port = DEFAULT_PORT } = {}) {
  checkId(chatId);
  const name = String(title || '').trim();
  if (!name) throw new Error('title required');
  return run('rename', { id: chatId, title: name }, port);
}

/** Cursor's icon colours, as its picker lists them. */
export const ICON_COLORS = [
  ['default', 'Default'],
  ['green', 'Green'],
  ['cyan', 'Cyan'],
  ['blue', 'Blue'],
  ['purple', 'Purple'],
  ['magenta', 'Magenta'],
  ['orange', 'Orange'],
  ['yellow', 'Yellow'],
  ['red', 'Red'],
  ['brand', 'Brand'],
];

// The picker's first screen, used when the installed bundle cannot be read.
const FEATURED_ICONS = [
  'code', 'terminal', 'bug', 'git-branch', 'brackets-curly', 'chip', 'folder', 'book-open', 'file-text',
  'files', 'library', 'globe', 'browser', 'link', 'chat-bubbles', 'envelope', 'megaphone', 'paperplane',
  'briefcase', 'calendar', 'board-kanban', 'list-todo', 'target', 'flag', 'database', 'chart-bars',
  'graph-line', 'table', 'atom', 'beaker', 'microscope', 'brain', 'palette', 'brush', 'camera', 'image',
  'music', 'magic-wand', 'cloud', 'server', 'shield', 'lightning', 'rocket', 'sparkle', 'star', 'moon',
  'heart', 'smiley-happy',
];

let iconCatalog = null;

/**
 * Every icon name the picker accepts, read once from the installed Agents
 * bundle: the names ship front-coded (each entry keeps a base-36 count of
 * the previous name's characters), and the picker drops "legacy" and
 * "filled" variants. Featured icons come first, as in Cursor.
 */
export function decodeIconCatalog(source) {
  const decoder = /function (\w+)\(t\)\{const e=\[\];let n="";for\(const i of t\.split\(" "\)\)n=n\.slice\(0,Number\.parseInt\(i\[0\],36\)\)\+i\.slice\(1\),e\.push\(n\)/.exec(source);
  if (!decoder) return null;
  const call = new RegExp(`[,;\\s]\\w+=${decoder[1]}\\((\\w+)\\)`).exec(source);
  if (!call) return null;
  const literal = new RegExp(`[,;\\s]${call[1]}="([^"]*)"`).exec(source);
  if (!literal) return null;
  const names = [];
  let prev = '';
  for (const part of literal[1].split(' ')) {
    prev = prev.slice(0, Number.parseInt(part[0], 36)) + part.slice(1);
    names.push(prev);
  }
  const usable = names.filter((n) => !n.toLowerCase().includes('legacy') && !n.includes('filled'));
  const featured = /label:"Brand"\}\],\w+=\[([^\]]*)\]/.exec(source);
  const first = featured ? [...featured[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : FEATURED_ICONS;
  const set = new Set(usable);
  return [...first.filter((n) => set.has(n)), ...usable.filter((n) => !first.includes(n))];
}

async function loadIconCatalog(port) {
  if (iconCatalog) return iconCatalog;
  try {
    const targets = await cdpFor(port).listTargets();
    const glass = targets.find((t) => /workbench/i.test(t.url || '') && /Agents/i.test(t.title || '')) ||
      targets.find((t) => /workbench/i.test(t.url || ''));
    let file = decodeURIComponent(String(glass?.url || '').replace('vscode-file://vscode-app/', ''));
    if (/^\/[A-Za-z]:/.test(file)) file = file.slice(1);
    const out = file.indexOf('/out/');
    if (out >= 0) {
      const bundle = `${file.slice(0, out)}/out/vs/workbench/workbench.glass.main.js`;
      iconCatalog = decodeIconCatalog(readFileSync(bundle, 'utf8'));
    }
  } catch {
    iconCatalog = null;
  }
  return iconCatalog || FEATURED_ICONS;
}

// A colour picked before any icon waits here, as Cursor's picker keeps it
// until an icon is chosen — an appearance is always both.
const pendingColor = new Map();

/**
 * Read a chat's icon and the choices (optionally searched), set a colour /
 * icon, or `clear` it back to none. Colours and icons are named by their
 * labels; icon labels are Cursor's icon names.
 * @returns {Promise<{ ok: boolean, colors?: {label, checked}[], icons?: {label, selected}[], current?: string }>}
 */
export async function rowIcon(chatId, { query = '', color = '', icon = '', clear = false, port = DEFAULT_PORT } = {}) {
  checkId(chatId);
  let res = await run('appearance', clear ? { id: chatId, appearance: null } : { id: chatId }, port);
  if (!res.ok) return res;
  if (clear) pendingColor.delete(chatId);
  const catalog = await loadIconCatalog(port);
  let current = res.current || null;
  if (!clear && (color || icon)) {
    const colorId = color
      ? ICON_COLORS.find(([id, label]) => label === color || id === color)?.[0]
      : current?.colorId || pendingColor.get(chatId) || 'default';
    if (!colorId) return { ok: false, reason: 'no-item', words: ICON_COLORS.map(([, label]) => label) };
    if (icon && !catalog.includes(icon)) return { ok: false, reason: 'no-item', words: [icon] };
    const nextIcon = icon || current?.icon;
    if (nextIcon) {
      res = await run('appearance', { id: chatId, appearance: { icon: nextIcon, colorId } }, port);
      if (!res.ok) return res;
      current = res.current;
      pendingColor.delete(chatId);
    } else {
      pendingColor.set(chatId, colorId);
    }
  }
  const shownColor = current?.colorId || pendingColor.get(chatId) || 'default';
  const words = String(query).trim().toLowerCase().split(/[\s/_]+/).filter(Boolean);
  let icons = words.length ? catalog.filter((n) => words.every((w) => n.toLowerCase().includes(w))) : catalog;
  if (current?.icon && !words.length) icons = [current.icon, ...icons.filter((n) => n !== current.icon)];
  return {
    ok: true,
    colors: ICON_COLORS.map(([id, label]) => ({ label, checked: id === shownColor })),
    icons: icons.slice(0, 160).map((label) => ({ label, selected: label === current?.icon, glyph: iconGlyph(label) })),
    current: current?.icon || '',
  };
}
