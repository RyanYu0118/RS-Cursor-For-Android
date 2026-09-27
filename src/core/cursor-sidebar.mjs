/**
 * Cursor's Agents sidebar as the window shows it, read and pressed over the
 * debug port.
 *
 * Which chats are Pinned is not on disk where Auto can read it: only some
 * carry `projectAppearance`, and writing that field does not reach a running
 * window. The live sidebar is the truth, so Pinned is read from it and every
 * row action (Pin, Rename, Edit Icon, Fork, Move to, Copy, Archive…) is
 * pressed through the row's own menu.
 *
 * Rows are found by `data-sidebar-item-key="row:<composerId>"` and the Pinned
 * group by `data-agent-drop-section-id="__pinned_agents__"` — data attributes,
 * not Cursor's generated classes. Menu items are found by the first line of
 * their words (the second is a shortcut or detail). The menu is a Base UI
 * popup that selects on pointer up, so a bare `click()` does nothing; the full
 * pointer sequence is dispatched. A submenu opens on hover.
 */
import { CursorWindow, DEFAULT_PORT } from './cursor-cdp.mjs';
import { putText, takeText } from './clipboard.mjs';

const DISCOVER_TIMEOUT_MS = 1500;

// Past six pins Cursor shows five and a "More" row. Pressing it expands the
// group for good (there is no "Less"), which is what reading every pin takes.
const READ_PINNED = `(async () => {
  const rows = document.querySelectorAll('[data-sidebar-item-key^="row:"]');
  if (!rows.length) return null;
  const sec = document.querySelector('[data-agent-drop-section-id="__pinned_agents__"]');
  if (!sec) return [];
  const label = sec.querySelector('[data-sidebar-group-label]');
  if (label && label.getAttribute('aria-expanded') === 'false') return null;
  const more = [...sec.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'More');
  if (more) {
    (more.closest('[role=button],button') || more).click();
    await new Promise((r) => setTimeout(r, 400));
  }
  return [...sec.querySelectorAll('[data-sidebar-item-key^="row:"]')].map((li) => ({
    id: li.getAttribute('data-sidebar-item-key').slice(4),
    name: (li.innerText || '').split('\\n')[0].trim(),
  }));
})()`;

/** Shared in-page helpers; `CHAT` and `PREFER_PINNED` are spliced in. */
function rowScript(chatId, { preferPinned = false } = {}, body) {
  return `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const fire = (el, kinds, buttons) => {
      const r = el.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, composed: true, clientX: r.x + 10, clientY: r.y + r.height / 2,
        pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons };
      for (const k of kinds) el.dispatchEvent(new (k.startsWith('pointer') ? PointerEvent : MouseEvent)(k, o));
    };
    const press = (el) => {
      fire(el, ['pointerover', 'pointerenter', 'pointermove', 'mousemove', 'pointerdown', 'mousedown'], 1);
      fire(el, ['pointerup', 'mouseup', 'click'], 0);
    };
    const hover = (el) => fire(el, ['pointerover', 'pointerenter', 'pointermove', 'mouseover', 'mousemove'], 0);
    const escape = async () => {
      for (let i = 0; i < 3 && document.querySelector('[role=menu]'); i++) {
        (document.activeElement || document).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
        await sleep(120);
      }
    };
    const firstLine = (el) => (el.innerText || '').split('\\n')[0].trim();
    const menus = () => [...document.querySelectorAll('[role=menu]')];
    const itemsOf = (menu) => [...menu.querySelectorAll('[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox]')];
    const findItem = (menu, words) => {
      const list = itemsOf(menu);
      for (const w of words) {
        const hit = list.find((e) => firstLine(e) === w);
        if (hit) return hit;
      }
      return null;
    };
    const chatKey = 'row:' + ${JSON.stringify(chatId)};
    const pinSec = () => document.querySelector('[data-agent-drop-section-id="__pinned_agents__"]');
    const row = () => {
      const rows = [...document.querySelectorAll('[data-sidebar-item-key="' + chatKey + '"]')];
      const inPin = rows.find((e) => pinSec()?.contains(e));
      const outPin = rows.find((e) => !pinSec()?.contains(e));
      return ${preferPinned} ? inPin || outPin : outPin || inPin;
    };
    const openMenu = async () => {
      const li = row();
      const target = li.querySelector('a,button,[role=button],[tabindex]') || li;
      const r = target.getBoundingClientRect();
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
        clientX: r.x + 20, clientY: r.y + r.height / 2, button: 2 }));
      for (let i = 0; i < 10 && !menus().length; i++) await sleep(60);
      await sleep(120);
      return menus()[0] || null;
    };
    const openSub = async (menu, word) => {
      const item = findItem(menu, [word]);
      if (!item) return null;
      const before = menus().length;
      hover(item);
      for (let i = 0; i < 10 && menus().length <= before; i++) await sleep(60);
      await sleep(120);
      return menus().length > before ? menus().pop() : null;
    };
    if (!document.querySelector('[data-sidebar-item-key^="row:"]')) return { ok: false, reason: 'no-sidebar' };
    if (!row()) return { ok: false, reason: 'not-shown' };
    try {
      ${body}
    } finally {
      await escape();
    }
  })()`;
}

/** Press a path of menu words: `[['Pin']]`, `[['Copy'], ['Copy Agent ID']]`. */
function pressPathScript(chatId, path, opts) {
  return rowScript(
    chatId,
    opts,
    `let menu = await openMenu();
    if (!menu) return { ok: false, reason: 'no-menu' };
    const path = ${JSON.stringify(path)};
    for (let i = 0; i < path.length - 1; i++) {
      menu = await openSub(menu, path[i][0]);
      if (!menu) return { ok: false, reason: 'no-item', words: [path[i][0]] };
    }
    const item = findItem(menu, path[path.length - 1]);
    if (!item) return { ok: false, reason: 'no-item', words: itemsOf(menu).map(firstLine) };
    press(item);
    await sleep(500);
    return { ok: true };`,
  );
}

function readMenuScript(chatId, sub) {
  return rowScript(
    chatId,
    {},
    `let menu = await openMenu();
    if (!menu) return { ok: false, reason: 'no-menu' };
    const sub = ${JSON.stringify(sub || '')};
    const list = (m) => itemsOf(m).map((e) => {
      const lines = (e.innerText || '').split('\\n').map((s) => s.trim()).filter(Boolean);
      return { label: lines[0] || '', detail: lines.slice(1).join(' '), sub: e.getAttribute('aria-haspopup') === 'menu',
        disabled: e.getAttribute('aria-disabled') === 'true' };
    });
    if (!sub) return { ok: true, items: list(menu) };
    const inner = await openSub(menu, sub);
    if (!inner) return { ok: false, reason: 'no-item', words: [sub] };
    return { ok: true, items: list(inner) };`,
  );
}

function renameScript(chatId, title) {
  return rowScript(
    chatId,
    { preferPinned: true },
    `const menu = await openMenu();
    const item = menu && findItem(menu, ['Rename']);
    if (!item) return { ok: false, reason: 'no-item', words: menu ? itemsOf(menu).map(firstLine) : [] };
    const key = row().getAttribute('data-sidebar-item-key');
    const inPin = Boolean(pinSec()?.contains(row()));
    press(item);
    let input = null;
    for (let i = 0; i < 12 && !input; i++) {
      await sleep(60);
      const li = [...document.querySelectorAll('[data-sidebar-item-key="' + key + '"]')].find((e) => Boolean(pinSec()?.contains(e)) === inPin);
      input = li?.querySelector('input');
    }
    if (!input) return { ok: false, reason: 'no-input' };
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, ${JSON.stringify(title)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    await sleep(500);
    return { ok: true };`,
  );
}

/**
 * Open Edit Icon, optionally search, read or choose, close. Colours are the
 * `aria-pressed` swatches in its fieldset; icons are the `Icons` listbox options.
 */
function iconScript(chatId, { query = '', color = '', icon = '' } = {}) {
  return rowScript(
    chatId,
    { preferPinned: true },
    `const menu = await openMenu();
    const item = menu && findItem(menu, ['Edit Icon']);
    if (!item) return { ok: false, reason: 'no-item', words: menu ? itemsOf(menu).map(firstLine) : [] };
    press(item);
    let picker = null;
    for (let i = 0; i < 12 && !picker; i++) {
      await sleep(60);
      picker = document.querySelector('[role=listbox][aria-label="Icons"]');
    }
    if (!picker) return { ok: false, reason: 'no-picker' };
    const panel = picker.closest('[role=menu]') || document;
    const colors = () => [...panel.querySelectorAll('fieldset button[aria-pressed]')];
    const query = ${JSON.stringify(query)};
    if (query) {
      const search = panel.querySelector('input');
      if (search) {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(search, query);
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(250);
      }
    }
    const color = ${JSON.stringify(color)};
    const icon = ${JSON.stringify(icon)};
    if (color) {
      const b = colors().find((e) => (e.getAttribute('aria-label') || e.innerText || '').trim() === color);
      if (!b) return { ok: false, reason: 'no-item', words: colors().map((e) => e.getAttribute('aria-label')) };
      press(b);
      await sleep(250);
    }
    if (icon) {
      const o = [...picker.querySelectorAll('[role=option]')].find((e) => (e.getAttribute('aria-label') || e.innerText || '').trim() === icon);
      if (!o) return { ok: false, reason: 'no-item', words: [icon] };
      press(o);
      await sleep(250);
    }
    return {
      ok: true,
      colors: colors().map((e) => ({ label: (e.getAttribute('aria-label') || e.innerText || '').trim(), checked: e.getAttribute('aria-pressed') === 'true' })),
      current: (picker.querySelector('[role=option][aria-selected=true]')?.getAttribute('aria-label') || '').trim(),
      icons: [...picker.querySelectorAll('[role=option]')].slice(0, 160).map((e) => ({
        label: (e.getAttribute('aria-label') || e.innerText || '').trim(), selected: e.getAttribute('aria-selected') === 'true' })),
    };`,
  );
}

async function pageTargets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json`, {
    signal: AbortSignal.timeout(DISCOVER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`the debug port answered HTTP ${res.status}`);
  const list = await res.json();
  // The Agents window first: it is the one that carries the sidebar.
  return list
    .filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)
    .sort((a, b) => Number(/Agents/i.test(b.title)) - Number(/Agents/i.test(a.title)));
}

async function firstAnswer(port, script, accept) {
  let targets;
  try {
    targets = await pageTargets(port);
  } catch {
    return null;
  }
  for (const target of targets) {
    let win;
    try {
      win = await CursorWindow.open(target);
      const value = await win.evaluate(script);
      if (accept(value)) return value;
    } catch {
      /* next window */
    } finally {
      win?.close();
    }
  }
  return null;
}

/** Run a row script in whichever window shows the sidebar. */
async function onRow(script, port) {
  let lastMiss = null;
  const hit = await firstAnswer(port, script, (v) => {
    if (v?.ok) return true;
    if (v && v.reason !== 'no-sidebar') lastMiss = v;
    return false;
  });
  return hit || lastMiss || { ok: false, reason: 'no-cdp' };
}

function checkId(chatId) {
  if (!/^[\w-]+$/.test(String(chatId || ''))) throw new Error('chatId required');
}

/**
 * The Pinned group as the window shows it, in its order.
 * @returns {Promise<{id: string, name: string}[] | null>} null when no window
 *   is showing the sidebar (Cursor down, no debug port, group collapsed).
 */
export async function readLivePinned({ port = DEFAULT_PORT } = {}) {
  return firstAnswer(port, READ_PINNED, (v) => Array.isArray(v));
}

/** Menu words for each action; the first that exists is pressed. */
export const ROW_ACTIONS = {
  pin: [['Pin']],
  unpin: [['Unpin']],
  archive: [['Archive']],
  unread: [['Mark as Unread', 'Mark as Read']],
  fork: [['Fork']],
};

export const COPY_ITEMS = {
  'agent-id': 'Copy Agent ID',
  branch: 'Copy Branch',
  transcript: 'Copy Transcript',
};

/**
 * Press a row action in Cursor's sidebar.
 * @param {string} action  a key of ROW_ACTIONS, or `move` / `copy` with `target`
 * @returns {Promise<{ ok: boolean, reason?: string, words?: string[], text?: string }>}
 *   reason `no-cdp` when no window answered at all.
 */
export async function pressSidebarAction(chatId, action, { port = DEFAULT_PORT, target = '' } = {}) {
  checkId(chatId);
  let path = ROW_ACTIONS[action];
  if (action === 'move') path = [['Move to'], [String(target)]];
  if (action === 'copy') {
    const word = COPY_ITEMS[target] || String(target);
    path = [['Copy'], [word]];
  }
  if (!path) throw new Error(`Unknown sidebar action ${action}`);
  const script = pressPathScript(chatId, path, { preferPinned: action === 'unpin' });
  if (action !== 'copy') return onRow(script, port);
  // Copy lands on the computer's clipboard; bring the words back and put the
  // clipboard back the way it was.
  const held = await takeText().catch(() => '');
  const res = await onRow(script, port);
  if (!res.ok) return res;
  await new Promise((r) => setTimeout(r, 250));
  const text = await takeText().catch(() => '');
  await putText(held).catch(() => {});
  return { ...res, text };
}

/** What a row's menu (or one of its submenus) offers right now. */
export async function readRowMenu(chatId, { sub = '', port = DEFAULT_PORT } = {}) {
  checkId(chatId);
  return onRow(readMenuScript(chatId, sub), port);
}

export async function renameRow(chatId, title, { port = DEFAULT_PORT } = {}) {
  checkId(chatId);
  const name = String(title || '').trim();
  if (!name) throw new Error('title required');
  return onRow(renameScript(chatId, name), port);
}

/**
 * Read the Edit Icon picker (optionally filtered), or choose a colour / icon.
 * @returns {Promise<{ ok: boolean, colors?: {label, checked}[], icons?: {label, selected}[] }>}
 */
export async function rowIcon(chatId, { query = '', color = '', icon = '', port = DEFAULT_PORT } = {}) {
  checkId(chatId);
  const res = await onRow(iconScript(chatId, { query, color, icon }), port);
  if (!res.ok || (!color && !icon)) return res;
  // Choosing an icon closes the picker, so what it said last is stale.
  return onRow(iconScript(chatId, { query }), port);
}
