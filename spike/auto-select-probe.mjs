/**
 * How Cursor's model menu says Auto-select is on, and what turns it off.
 *
 * Auto could turn Auto-select *on* (press the Auto row) but never off: pressing
 * that row again does nothing, and every named model stays hidden while it is
 * on. This reads the menu as Auto reads it — plus the raw Auto row — so the
 * off switch can be found rather than guessed at.
 *
 * Reversible: opens the picker, reads, presses Escape. Presses no row.
 *
 * Usage: node spike/auto-select-probe.mjs [window-title-substring]
 */
import { CursorWindow } from '../src/core/cursor-cdp.mjs';

const want = (process.argv[2] || 'Praise').toLowerCase();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The Auto row and the search box, exactly as the DOM has them. */
const RAW = `(() => {
  const say = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      testid: el.getAttribute('data-testid'),
      role: el.getAttribute('role'),
      checked: el.getAttribute('aria-checked'),
      selected: el.getAttribute('aria-selected'),
      dataState: el.getAttribute('data-state'),
      attrs: el.getAttributeNames().filter((a) => a !== 'class' && a !== 'style').join(','),
      text: (el.textContent || '').replace(/[\\u200b\\s]+/g, ' ').trim().slice(0, 60),
      box: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    };
  };
  const menu =
    document.querySelector('[data-testid="selected-model-list-submenu"]') ||
    document.querySelector('[data-testid="model-picker-menu"]');
  const params = document.querySelector('[data-testid="selected-model-parameters-submenu-menu"]');
  const auto =
    document.querySelector('[data-testid="auto-mode-select"]') ||
    document.querySelector('[data-testid="auto-mode-toggle"]');
  const search =
    (menu || document).querySelector('[data-component="menu-search-row"] input') ||
    (menu || document).querySelector('input[placeholder="Search models"]');
  return {
    hasModelList: Boolean(menu),
    hasParameters: Boolean(params),
    auto: say(auto),
    autoKids: auto ? [...auto.querySelectorAll('*')].slice(0, 12).map(say) : [],
    search: say(search),
    modelRows: [...(menu || document).querySelectorAll('[data-testid^="model-item-"]')]
      .slice(0, 8)
      .map((el) => ({ ...say(el), testid: el.getAttribute('data-testid') })),
  };
})()`;

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const pages = targets.filter((t) => t.type === 'page' && /workbench/i.test(String(t.url || '')));
const target = pages.find((t) => String(t.title || '').toLowerCase().includes(want));
if (!target) {
  console.log(`no Cursor window whose title contains ${JSON.stringify(want)}`);
  console.log('windows:', pages.map((t) => t.title).join(' | '));
  process.exit(1);
}

const window = await CursorWindow.open(target);
try {
  console.log(`window: ${target.title}`);
  const before = await window.pickerAt('model');
  console.log(`model trigger says: ${JSON.stringify(before?.label)}\n`);

  await window.mouseAt(before);
  let items = { open: 0, items: [] };
  for (let look = 0; look < 10 && !items.items.length; look += 1) {
    await wait(250);
    items = (await window.menuItems()) || items;
  }

  console.log(`menuItems (Auto's own view) — open=${items.open}, ${items.items.length} items`);
  for (const it of items.items) {
    console.log(
      `  ${JSON.stringify(it.label).padEnd(42)} current=${it.current ?? '-'} source=${it.source} @ ${Math.round(it.x)},${Math.round(it.y)}`,
    );
  }

  console.log('\nraw DOM:');
  console.log(JSON.stringify(await window.evaluate(RAW), null, 2));

  const gate = items.items.find((it) => String(it.label).trim().toLowerCase() === 'model');
  if (gate && process.argv.includes('--open')) {
    console.log('\npressing the Model row…');
    await window.mouseAt(gate);
    let sub = { open: 0, items: [] };
    for (let look = 0; look < 10; look += 1) {
      await wait(250);
      sub = (await window.menuItems()) || sub;
      if (sub.items.some((it) => it.source === 'model-list')) break;
    }
    console.log(`submenu — open=${sub.open}, ${sub.items.length} items`);
    for (const it of sub.items) {
      console.log(
        `  ${JSON.stringify(it.label).padEnd(42)} current=${it.current ?? '-'} source=${it.source} @ ${Math.round(it.x)},${Math.round(it.y)}`,
      );
    }
    console.log('\nraw DOM in submenu:');
    console.log(JSON.stringify(await window.evaluate(RAW), null, 2));
    await window.pressEscape();
    await wait(300);
  }

  await window.pressEscape();
  await wait(400);
  await window.pressEscape();
  await wait(300);
  const stillOpen = (await window.menuItems())?.open;
  console.log(`\nmenu still open after Escape: ${stillOpen}`);
  console.log(`model trigger now says: ${JSON.stringify((await window.pickerAt('model'))?.label)}`);
} finally {
  window.close();
}

process.exit(0);
