/**
 * Cursor's Agents sidebar as the window shows it, read and pressed over the
 * debug port.
 *
 * Which chats are Pinned is not on disk where Auto can read it: only some
 * carry `projectAppearance`, and writing that field does not reach a running
 * window. The live sidebar is the truth, so Pinned is read from it and
 * Pin / Unpin / Archive are pressed through the row's own menu.
 *
 * Rows are found by `data-sidebar-item-key="row:<composerId>"` and the Pinned
 * group by `data-agent-drop-section-id="__pinned_agents__"` — data attributes,
 * not Cursor's generated classes. Menu items are found by their words. The
 * menu is a Base UI popup that selects on pointer up, so a bare `click()` does
 * nothing; the full pointer sequence is dispatched.
 */
import { CursorWindow, DEFAULT_PORT } from './cursor-cdp.mjs';

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

const MENU_WORDS = { pin: 'Pin', unpin: 'Unpin', archive: 'Archive' };

function pressScript(chatId, action) {
  const word = MENU_WORDS[action];
  return `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const press = (el) => {
      const r = el.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, composed: true, clientX: r.x + 10, clientY: r.y + r.height / 2,
        pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
      for (const [T, k] of [[PointerEvent, 'pointerover'], [PointerEvent, 'pointerenter'], [PointerEvent, 'pointermove'],
        [MouseEvent, 'mousemove'], [PointerEvent, 'pointerdown'], [MouseEvent, 'mousedown']]) el.dispatchEvent(new T(k, o));
      const up = { ...o, buttons: 0 };
      for (const [T, k] of [[PointerEvent, 'pointerup'], [MouseEvent, 'mouseup'], [MouseEvent, 'click']]) el.dispatchEvent(new T(k, up));
    };
    const rows = [...document.querySelectorAll('[data-sidebar-item-key="row:${chatId}"]')];
    if (!document.querySelector('[data-sidebar-item-key^="row:"]')) return { ok: false, reason: 'no-sidebar' };
    if (!rows.length) return { ok: false, reason: 'not-shown' };
    const sec = document.querySelector('[data-agent-drop-section-id="__pinned_agents__"]');
    const li = rows.find((e) => ${action === 'unpin'} ? sec?.contains(e) : !sec?.contains(e)) || rows[0];
    const target = li.querySelector('a,button,[role=button],[tabindex]') || li;
    const r = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
      clientX: r.x + 20, clientY: r.y + r.height / 2, button: 2 }));
    let item = null;
    for (let i = 0; i < 10 && !item; i++) {
      await sleep(80);
      item = [...document.querySelectorAll('[role=menuitem]')].find((e) => (e.innerText || '').trim() === ${JSON.stringify(word)});
    }
    if (!item) {
      const words = [...document.querySelectorAll('[role=menuitem]')].map((e) => (e.innerText || '').trim());
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return { ok: false, reason: 'no-item', words };
    }
    press(item);
    await sleep(600);
    return { ok: true };
  })()`;
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

/**
 * The Pinned group as the window shows it, in its order.
 * @returns {Promise<{id: string, name: string}[] | null>} null when no window
 *   is showing the sidebar (Cursor down, no debug port, group collapsed).
 */
export async function readLivePinned({ port = DEFAULT_PORT } = {}) {
  return firstAnswer(port, READ_PINNED, (v) => Array.isArray(v));
}

/**
 * Press Pin / Unpin / Archive on a chat's row in Cursor's sidebar.
 * @returns {Promise<{ ok: boolean, reason?: string, words?: string[] }>}
 *   reason `no-cdp` when no window answered at all.
 */
export async function pressSidebarAction(chatId, action, { port = DEFAULT_PORT } = {}) {
  if (!MENU_WORDS[action]) throw new Error(`Unknown sidebar action ${action}`);
  if (!/^[\w-]+$/.test(String(chatId || ''))) throw new Error('chatId required');
  let lastMiss = null;
  const hit = await firstAnswer(port, pressScript(chatId, action), (v) => {
    if (v?.ok) return true;
    if (v && v.reason !== 'no-sidebar') lastMiss = v;
    return false;
  });
  return hit || lastMiss || { ok: false, reason: 'no-cdp' };
}
