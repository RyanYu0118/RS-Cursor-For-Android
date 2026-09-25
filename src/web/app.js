/**
 * Auto v2 web client.
 *
 * A projection of the host's transcript: it attaches to a session, replays
 * from a sequence number, and renders records as they stream. The host is
 * still the source of truth; a local cache (memory + IndexedDB) only keeps
 * the last stretch so a reload or switching back can paint immediately and
 * catch up from lastSeq. Which chat was open is remembered separately.
 */

import {
  initTerminals,
  openPane,
  closePane,
  resetTerminals,
  retheme,
  writeChunk,
} from './terminals.js';
import { lineDiff, collapseContext, diffStats } from './diff.js';
import { renderMarkdown, linkify } from './markdown.js';
import { enrichMarkdown } from './enrich.js';
import { modelPrice } from './model-pricing.js';
import { controlsFor } from './model-parameters.js';
import { initBrowser, onFrame, onStatus, syncBrowserTheme } from './browser.js';
import { initWorkspace, isOpen as workspaceIsOpen, showChat, onViewsChange, restoreViews } from './workspace.js';
import {
  activityCopy,
  changedFiles,
  classifyTool,
  displayLabel,
  durationText,
  fileStats,
  isCreatedPlan,
  planFields,
  isBrowserTool,
  stepShown,
  thoughtLabel,
  toolOutputText,
  turnCopy,
  workCopy,
} from './desktop-tool-ui.js';
import {
  appendLive,
  flushDiskSave,
  loadCache,
  makeSnap,
  memoryGet,
  mergeRecords,
  saveCache,
  scheduleDiskSave,
} from './transcript-cache.js';

const $ = (id) => document.getElementById(id);

/** Build stamped into index.html; compared to the host on reconnect and poll. */
const WEB_BUILD = document.querySelector('meta[name="auto-build"]')?.content || '';
let updateBannerShown = false;

const els = {
  app: $('app'),
  rail: $('session-list'),
  transcript: $('transcript'),
  historyLoading: $('transcript-loading'),
  box: $('box'),
  send: $('send'),
  stop: $('stop'),
  title: $('session-title'),
  folder: $('session-folder'),
  status: $('status'),
  mode: $('mode'),
  composer: $('composer'),
  composerBox: document.querySelector('.composer-box'),
  topbar: $('topbar'),
  viewChat: $('view-chat'),
  model: $('model'),
  modelOpen: $('model-open'),
  modelSummary: $('model-summary'),
  modelSheet: $('model-sheet'),
  modelPanel: document.querySelector('.model-panel'),
  modelPages: $('model-pages'),
  modelSettingsPage: document.querySelector('.model-page[data-page="settings"]'),
  modelSheetTitle: $('model-sheet-title'),
  modelBack: $('model-back'),
  modelClose: $('model-close'),
  modelAuto: $('model-auto'),
  modelChoice: $('model-choice'),
  modelChoiceLabel: $('model-choice-label'),
  modelListPane: $('model-list-pane'),
  modelFilter: $('model-filter'),
  modelList: $('model-list'),
  modelParameters: $('model-parameters'),
  modelParametersGroup: $('model-parameters-group'),
  modelStatus: $('model-status'),
  policy: $('policy'),
  conn: $('conn'),
  sheet: $('sheet'),
  toBottom: $('to-bottom'),
  scrub: $('chat-scrub'),
  scrubHandle: document.querySelector('#chat-scrub .scrub-handle'),
  scrubTimeline: document.querySelector('#chat-scrub .scrub-timeline'),
  attachments: $('attachments'),
  file: $('file'),
  queue: $('queue'),
  queueCount: $('queue-count'),
  queueList: $('queue-list'),
  usage: $('usage'),
  usageSheet: $('usage-sheet'),
  usageBody: $('usage-body'),
  planSheet: $('plan-sheet'),
  planSheetTitle: $('plan-sheet-title'),
  planBody: $('plan-body'),
  planFoot: $('plan-foot'),
  planBuild: $('plan-build'),
  planBuildModel: $('plan-build-model'),
  planOutcome: $('plan-outcome'),
};

const state = {
  ws: null,
  sessionId: null,
  sessions: [],
  projects: [],
  /** Cursor's Agents sidebar: pinned projects and repository groups. */
  sidebar: null,
  /** agents the host can drive: {name, available, default, reason} */
  agents: [],
  /** agent the New session sheet will start, when there is a choice */
  newbieAgent: null,
  /** folder the New session browser is looking at, and its parent */
  dirPath: null,
  dirParent: null,
  /** Cursor's own recent chats, whichever project they belong to */
  chats: [],
  lastSeq: 0,
  /** records currently drawn for this session (tail only) — fed into the cache */
  liveRecords: [],
  /** pinned opening prompt (through the first real user message) */
  liveHead: [],
  /** how many records sit between liveHead and liveRecords (omitted middle) */
  liveEarlier: 0,
  /** painted from cache; attached must still restore tool tabs even on catch-up */
  paintedFromCache: false,
  busy: false,
  /** toolCallId -> element, so tool_update mutates the card it belongs to */
  toolCards: new Map(),
  /** consecutive groupable/file-change calls folded into one card */
  bundle: null,
  /** requestId -> element */
  permCards: new Map(),
  /** askId -> element, so a question can be marked answered where it stands */
  askCards: new Map(),
  /** toolCallId of the plan currently open in the full-window viewer */
  openPlanId: null,
  /** card element for that open plan — Build in the footer uses it */
  openPlanCard: null,
  stream: null,
  streamKind: null,
  /** rendered-html child of the live agent bubble (keeps the copy footer intact) */
  streamBody: null,
  /** the thinking block being written to, so it can be folded when it ends */
  thinking: null,
  /** quiet's one thinking block for the turn: sequential spells fold into it */
  quietThinking: null,
  /** timestamp of the record currently being drawn, so replayed thinking is timed */
  now: 0,
  /** the open turn: when it started, whether tools ran, the live status line */
  turn: null,
  /** interval ticking the live turn's elapsed time, or null */
  turnClock: null,
  /** how much tool detail to draw: quiet | normal | verbose (host-owned) */
  verbosity: 'normal',
  /** true while the pane is at the live edge; a scroll away turns it off */
  atBottom: true,
  /** "Working…" while a turn runs; becomes "Worked for 7m 3s" when it ends */
  statusEl: null,
  /** true while history is being painted, so finished turns do not flash Working */
  replaying: false,
  /** prompt to put back in the box once replay finishes (latest interrupt only) */
  pendingRestore: null,
  /** turn was pulled back into the composer — skip the "Worked for…" line */
  withdrawnTurn: false,
  lastPrompt: '',
  /** images waiting to go with the next prompt: {mimeType, data, url} */
  attachments: [],
  /** what is waiting for the turn to end: {owner, waiting, items, hidden} */
  queue: { owner: 'auto', waiting: 0, items: [] },
  /** the queued message being reworded, so the row stays an editor while typing */
  editing: null,
  /** Cursor chats dismissed with × this visit, so they do not reappear as "in Cursor" */
  dismissedChats: new Set(),
  /** unsent composer text (and images) kept per session across switches */
  drafts: new Map(),
  /** When we last changed the box locally — remote drafts older than this lose. */
  draftAt: 0,
  draftTimer: null,
  draftApplying: false,
  /** a send drawn immediately: credits that swallow the host record (and a stray echo) */
  pendingEchoes: [],
  /** latest usage snapshot for the dial / dialog */
  usage: null,
  /** Cursor's live Auto / Fast / Context / Reasoning / Effort controls */
  modelControls: null,
  /** a model/menu press is in flight; lock duplicate changes until Cursor replies */
  modelUpdating: false,
  usageTimer: null,
  /** after session.create, put the caret in the box once the chat is attached */
  focusComposer: false,
  /** this machine: OS hostname, optional nick, label for the rail */
  host: { hostname: '', nick: null, label: '' },
  /** chat scrubber: visible while scrolling a long transcript */
  scrubHide: null,
  scrubbing: false,
  scrubTimelineDirty: true,
  /** landmark elements currently drawn as timeline pills */
  scrubEntries: [],
  /** landmark currently snapped to while scrubbing (for haptic edges) */
  scrubSnapEl: null,
  /** finger is on the grip — layout follows the finger, not snapped scrollTop */
  scrubPointer: false,
  /** 0–1 along the rail while scrubPointer; labels read this, chat may snap */
  scrubDriveRatio: null,
};

// ------------------------------------------------------------------ helpers

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Agent prose renders as markdown; user prose stays as typed, except that
bare http(s) URLs are links in both. Markdown `[text](url)` was already a
link; a URL sitting in the sentence was not. */
const markdown = renderMarkdown;

function nearBottom() {
  const t = els.transcript;
  return t.scrollHeight - t.scrollTop - t.clientHeight < 160;
}

/** Coalesce stick-to-bottom into one instant scroll per frame. CSS
 *  `scroll-behavior: smooth` on #transcript used to animate every chunk,
 *  so a fast answer stuttered and jumped as animations cancelled each other. */
let scrollDownRaf = 0;
function scrollDown(force = false) {
  if (!(force || nearBottom())) return;
  if (scrollDownRaf) return;
  scrollDownRaf = requestAnimationFrame(() => {
    scrollDownRaf = 0;
    const t = els.transcript;
    t.scrollTo({ top: t.scrollHeight, behavior: 'auto' });
  });
}

/** Smooth only for the explicit ↓ control — never for streamed chunks. */
function scrollDownSmooth() {
  els.transcript.scrollTo({ top: els.transcript.scrollHeight, behavior: 'smooth' });
}

/**
 * A long transcript takes a few seconds to arrive and draw. The overlay is
 * in the markup so it is there before this file runs; this only flips it.
 * A cache hit skips it — the conversation is already on screen.
 */
function setHistoryLoading(on) {
  els.historyLoading.hidden = !on;
  els.transcript.setAttribute('aria-busy', on ? 'true' : 'false');
}

/** Wipe the chat pane and the maps that point into it. */
function resetChatUi() {
  els.transcript.innerHTML = '';
  hideScrub(true);
  markScrubDirty();
  state.toolCards.clear();
  state.bundle = null;
  state.permCards.clear();
  state.askCards.clear();
  state.stream = null;
  state.streamKind = null;
  state.streamBody = null;
  state.thinking = null;
  state.quietThinking = null;
  state.liveFold = null;
  state.statusEl = null;
  state.turn = null;
  state.fileHomes = new Map();
  stopTurnClock();
  resetTerminals();
}

/** Keep the live record list (and cache) in step with what render just drew. */
function noteLiveRecord(rec) {
  if (state.replaying || !state.sessionId) return;
  if (typeof rec?.seq !== 'number') return;
  const { records, earlierDelta } = appendLive(state.liveRecords, rec);
  state.liveRecords = records;
  if (earlierDelta) state.liveEarlier += earlierDelta;
  persistLive(state.sessionId);
}

function persistLive(sessionId) {
  if (!sessionId || !(state.liveRecords.length || state.liveHead.length)) return;
  const snap = saveCache(sessionId, state.liveRecords, state.liveEarlier, state.liveHead);
  if (snap) scheduleDiskSave(sessionId, snap);
}

function adoptLive(records, earlier = 0, head = null) {
  const pinned = head == null ? state.liveHead : head;
  const snap = makeSnap(records, earlier, pinned);
  state.liveHead = (snap.head || []).slice();
  state.liveRecords = snap.records.slice();
  state.liveEarlier = snap.omitted || snap.earlier || 0;
  state.lastSeq = snap.lastSeq;
  if (state.sessionId && (snap.records.length || snap.head.length)) {
    saveCache(state.sessionId, snap.records, state.liveEarlier, snap.head);
    scheduleDiskSave(state.sessionId, snap);
  }
}

/** fromSeq for a cached snap. */
function cacheAttachSeq(snap) {
  return snap?.lastSeq || 0;
}

/**
 * The "N earlier records are not shown." row, or null when nothing is omitted.
 * Tagged so ensureOpening can tell it apart from real conversation nodes.
 */
function earlierNotice(count) {
  if (!count || count <= 0) return null;
  const note = div('notice');
  note.dataset.earlier = '1';
  note.textContent = `${count.toLocaleString()} earlier records are not shown.`;
  return note;
}

/** Paint opening + optional omission notice + tail into an empty transcript. */
function paintTranscriptParts(head, omitted, records) {
  for (const rec of head || []) render(rec);
  const note = earlierNotice(omitted);
  if (note) add(note);
  for (const rec of records || []) render(rec);
}

/**
 * Prepend the opening prompt when catch-up brought it and the pane never had it
 * (e.g. a cache from before opening prompts were pinned).
 */
function ensureOpening(head, omitted) {
  if (!head?.length || state.liveHead.length) return;
  const keep = [...els.transcript.childNodes].filter(
    (n) => !(n.nodeType === 1 && n.dataset?.earlier),
  );
  els.transcript.innerHTML = '';
  state.replaying = true;
  for (const rec of head) render(rec);
  const gap =
    omitted > 0
      ? omitted
      : Math.max(0, (state.liveRecords[0]?.seq || 0) - head.at(-1).seq - 1);
  const note = earlierNotice(gap);
  if (note) add(note);
  state.replaying = false;
  for (const n of keep) els.transcript.appendChild(n);
  state.liveHead = head.slice();
  state.liveEarlier = gap;
  persistLive(state.sessionId);
  markScrubDirty();
}

/**
 * Draw a cached snapshot so the pane is not blank while the host catches up.
 * Tool tabs wait for `attached` (panes are host-owned); terminal chunks land
 * in the early buffer until then.
 */
function paintFromCache(snap) {
  if (!snap?.records?.length && !snap?.head?.length) return;
  resetChatUi();
  state.paintedFromCache = true;
  state.liveRecords = [];
  state.liveHead = [];
  state.liveEarlier = 0;
  state.lastSeq = 0;
  state.replaying = true;
  const omitted = snap.omitted || (snap.head?.length ? snap.earlier : 0) || 0;
  if (!snap.head?.length && snap.earlier > 0) {
    const note = earlierNotice(snap.earlier);
    if (note) add(note);
  }
  paintTranscriptParts(snap.head || [], snap.head?.length ? omitted : 0, snap.records || []);
  state.replaying = false;
  applyPendingRestore();
  state.liveHead = (snap.head || []).slice();
  state.liveRecords = (snap.records || []).slice();
  state.liveEarlier = omitted || snap.earlier || 0;
  state.lastSeq = snap.lastSeq || state.lastSeq;
  if (state.turn) endTurn({ ts: state.now || Date.now() });
  else settleRunningTools();
  decorate(els.transcript);
  scrollDown(true);
}

/** Long enough that "copy the whole answer as markdown" earns a button. */
const COPY_MD_MIN = 200;

/**
 * Flash a copy control as done, then restore. Text buttons pass a label;
 * icon buttons pass a restore function (or HTML string via opts.html).
 */
function flashCopied(btn, idle) {
  clearTimeout(btn._copyFlash);
  btn.classList.add('done');
  if (typeof idle === 'function') {
    btn._copyFlash = setTimeout(() => {
      idle();
      btn.classList.remove('done');
    }, 1200);
    return;
  }
  btn.textContent = 'Copied';
  btn._copyFlash = setTimeout(() => {
    btn.textContent = idle;
    btn.classList.remove('done');
  }, 1200);
}

/** Clipboard glyph — same stroke language as the rest of the chrome. */
const COPY_MD_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const COPY_MD_DONE =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/**
 * Code is worth taking away, so every block carries a copy button. It lives
 * inside the <pre> and is skipped when reading the text back, which keeps the
 * markup free of a wrapper element that streaming would keep destroying.
 *
 * Long agent answers also get a "Copy markdown" footer — the raw source sits
 * on the bubble as `data-raw`, so the clipboard gets what was written, not a
 * DOM→text guess that loses fences and emphasis.
 */
function decorate(root) {
  for (const pre of root.querySelectorAll?.('pre:not([data-copy])') ?? []) {
    pre.dataset.copy = '1';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'copy';
    b.textContent = 'Copy';
    b.setAttribute('aria-label', 'Copy code');
    b.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = [...pre.childNodes]
        .filter((n) => n !== b)
        .map((n) => n.textContent)
        .join('');
      try {
        await navigator.clipboard.writeText(text);
        flashCopied(b, 'Copy');
      } catch {
        b.textContent = 'Blocked';
      }
    };
    pre.prepend(b);
  }
  paintMarkdownImages(root);
  const msgs =
    root.matches?.('.msg.agent') ? [root] : [...(root.querySelectorAll?.('.msg.agent') ?? [])];
  for (const msg of msgs) syncAgentMdCopy(msg);
  enrichMarkdown(root);
}

/**
 * Point a picture named in an answer at the host, and let it be opened.
 *
 * The renderer leaves a host file as `data-file` because it cannot know which
 * chat named it, and a path relative to "the repo" means nothing without one.
 * Here we do: the open session decides the folder. A file the host refuses —
 * outside the chat's folder, or not an image — collapses to its alt text
 * rather than a broken-picture icon, because a caption is still an answer.
 */
function paintMarkdownImages(root) {
  for (const img of root.querySelectorAll?.('img[data-file]') ?? []) {
    const path = img.dataset.file;
    img.removeAttribute('data-file');
    if (!path || !state.sessionId) {
      img.replaceWith(captionFor(img));
      continue;
    }
    img.onerror = () => img.replaceWith(captionFor(img));
    img.src = `/api/image?session=${encodeURIComponent(state.sessionId)}&path=${encodeURIComponent(path)}`;
  }
  for (const img of root.querySelectorAll?.('img.md-img:not([data-zoom])') ?? []) {
    img.dataset.zoom = '1';
    img.onclick = () => openLightbox(img.currentSrc || img.src);
  }
}

function captionFor(img) {
  const said = document.createElement('span');
  said.className = 'md-img-missing';
  said.textContent = img.alt || 'image';
  said.title = 'This host would not serve that file';
  return said;
}

/**
 * Keep (or remove) the markdown copy footer as the answer grows. The button
 * sits outside `.agent-body`, so streaming HTML rewrites never destroy it.
 */
function syncAgentMdCopy(msg) {
  if (!msg?.classList?.contains('agent')) return;
  const raw = msg.dataset.raw || '';
  let foot = msg.querySelector(':scope > .copy-md');
  if (raw.length < COPY_MD_MIN) {
    foot?.remove();
    delete msg.dataset.mdCopy;
    return;
  }
  if (foot) return;
  msg.dataset.mdCopy = '1';
  foot = document.createElement('button');
  foot.type = 'button';
  foot.className = 'copy-md';
  foot.innerHTML = COPY_MD_ICON;
  foot.setAttribute('aria-label', 'Copy message as markdown');
  foot.title = 'Copy markdown';
  foot.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(msg.dataset.raw || '');
      foot.innerHTML = COPY_MD_DONE;
      flashCopied(foot, () => {
        foot.innerHTML = COPY_MD_ICON;
      });
    } catch {
      foot.title = 'Blocked';
    }
  };
  msg.append(foot);
}

/** The jump button only earns its place once you have scrolled away. */
function syncToBottom() {
  // Scrubbing owns the right edge — the ↓ would fight the grip.
  els.toBottom.hidden = state.scrubbing || nearBottom();
}

/**
 * Landmarks worth marking on the scrub timeline — the structure of a long
 * chat, not every tool card. Order matches the DOM.
 */
function scrubLandmarks() {
  return [...els.transcript.querySelectorAll('.msg.user, .ask, .created-plan, .perm')];
}

function scrubKindOf(el) {
  if (el.classList.contains('user')) return 'you';
  if (el.classList.contains('ask')) return 'question';
  if (el.classList.contains('created-plan')) return 'plan';
  if (el.classList.contains('perm')) return 'approval';
  return '';
}

function scrubLabel(el) {
  if (el.classList.contains('user')) {
    const t = el.querySelector('.user-text')?.textContent?.trim() || '';
    if (t) return { kind: 'You', text: t };
    if (el.querySelector('.thumbs, .cap')) return { kind: 'You', text: 'Image' };
    return { kind: 'You', text: 'Message' };
  }
  if (el.classList.contains('ask')) {
    const t =
      el.querySelector('.title')?.textContent?.trim() ||
      el.querySelector('.prompt')?.textContent?.trim() ||
      '';
    return { kind: 'Question', text: t || 'Waiting for an answer' };
  }
  if (el.classList.contains('created-plan')) {
    const t = el.querySelector('.title')?.textContent?.trim() || '';
    return { kind: 'Plan', text: t || 'Created plan' };
  }
  if (el.classList.contains('perm')) {
    const t = el.querySelector('.what')?.textContent?.trim() || '';
    return { kind: 'Approval', text: t || 'Needs a decision' };
  }
  return { kind: '', text: '' };
}

function scrubClip(s, n = 72) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trimEnd()}…`;
}

/** Tall enough that a scrubber earns its keep. */
function scrubWorthShowing() {
  const t = els.transcript;
  return t.scrollHeight > t.clientHeight + 240;
}

function scrubScrollRatio() {
  const t = els.transcript;
  const max = Math.max(1, t.scrollHeight - t.clientHeight);
  return Math.min(1, Math.max(0, t.scrollTop / max));
}

/**
 * Where the wheel and handle sit. While a finger drives the grip, that is the
 * finger — not scrolled/snapped chat — so labels glide even when the transcript
 * latches onto a landmark.
 */
function scrubLayoutRatio() {
  if (state.scrubPointer && typeof state.scrubDriveRatio === 'number') {
    return state.scrubDriveRatio;
  }
  return scrubScrollRatio();
}

/**
 * Build every landmark into a rotary timeline. More entries than fit are
 * deliberate: the wheel moves them through the viewport and fades its ends.
 */
function rebuildScrubTimeline() {
  if (!els.scrubTimeline) return;
  const t = els.transcript;
  const h = t.scrollHeight || 1;
  const maxScroll = Math.max(1, t.scrollHeight - t.clientHeight);
  const marks = scrubLandmarks();
  const entries = marks.map((el, i) => {
    const topPx = scrubScrollTopFor(el);
    const nextTop = i + 1 < marks.length ? scrubScrollTopFor(marks[i + 1]) : h;
    const span = Math.max(1, nextTop - topPx);
    return {
      el,
      kind: scrubKindOf(el),
      top: topPx / h,
      spanFrac: span / h,
      snapRatio: scrubScrollTopFor(el) / maxScroll,
      label: scrubLabel(el),
    };
  });
  els.scrubTimeline.replaceChildren();
  state.scrubEntries = [];

  for (const entry of entries) {
    const pill = document.createElement('div');
    pill.className = 'scrub-pill';
    pill.dataset.kind = entry.kind;
    paintScrubPill(pill, entry);
    els.scrubTimeline.append(pill);
    state.scrubEntries.push({ ...entry, pill });
  }
  state.scrubTimelineDirty = false;
  requestAnimationFrame(layoutScrubWheel);
}

function paintScrubPill(pill, entry) {
  let text = pill.querySelector('.scrub-text');
  if (!text) {
    text = document.createElement('span');
    text.className = 'scrub-text';
    pill.replaceChildren(text);
  }
  text.textContent = scrubClip(entry.label.text, 72);
  pill.style.width = '22px';
  pill.style.opacity = '0';
}

/**
 * Finger (or scroll) progress → fractional landmark index on the wheel.
 * Linear in the rail, not in chat scroll: a long stretch of text between two
 * landmarks must not make the labels crawl, and a dense cluster must not make
 * them leap. Chat scroll and snap stay on their own path.
 */
function scrubWheelProgress(ratio) {
  const entries = state.scrubEntries;
  if (entries.length <= 1) return 0;
  const r = Math.min(1, Math.max(0, ratio));
  return r * (entries.length - 1);
}

/**
 * Counter-scroll the label wheel. Its left edge traces a semicircle: width is
 * sqrt(r²-y²), widest at vertical centre and zero at the top/bottom.
 */
function layoutScrubWheel() {
  if (!state.scrubbing || !els.scrubTimeline) return;
  const entries = state.scrubEntries;
  if (!entries.length) return;
  const height = els.scrubTimeline.clientHeight;
  const centre = height / 2;
  const radius = Math.max(1, centre - 6);
  const gap = 34;
  const progress = scrubWheelProgress(scrubLayoutRatio());
  const activeIndex = Math.max(0, Math.min(entries.length - 1, Math.round(progress)));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const y = centre + (i - progress) * gap;
    const normalized = Math.min(1, Math.abs(y - centre) / radius);
    const circle = Math.sqrt(Math.max(0, 1 - normalized * normalized));
    const active = i === activeIndex;
    // Past the semicircle: hide hard. Opacity alone still painted a ghost
    // while width/colour eased, and half a pill sat past the clip edge.
    const onWheel = normalized < 1;
    entry.pill.style.top = `${y}px`;
    // Widest ~260px at centre — room for a readable sentence fragment.
    entry.pill.style.width = `${Math.round(22 + circle * 238)}px`;
    entry.pill.style.transform = 'translateY(-50%)';
    entry.pill.style.visibility = onWheel ? 'visible' : 'hidden';
    // Active stays fully readable even when slightly off-centre.
    entry.pill.style.opacity = String(
      !onWheel ? 0 : active ? Math.max(0.95, Math.pow(circle, 0.75)) : Math.pow(circle, 0.75),
    );
    entry.pill.classList.toggle('active', active);
  }
}

/** Scroll position that puts a landmark's top flush with the viewport top. */
function scrubScrollTopFor(el) {
  const t = els.transcript;
  const max = Math.max(0, t.scrollHeight - t.clientHeight);
  const top = el.getBoundingClientRect().top - t.getBoundingClientRect().top + t.scrollTop;
  return Math.max(0, Math.min(max, Math.round(top)));
}

/** Wheel/finger ratio → the landmark index highlighted on the rail. */
function activeScrubIndex(ratio) {
  const entries = state.scrubEntries;
  if (!entries.length) return 0;
  const progress = scrubWheelProgress(ratio);
  return Math.max(0, Math.min(entries.length - 1, Math.round(progress)));
}

/** Which landmark best matches the transcript's current scroll position. */
function nearestScrubEntryByScrollTop(scrollTop = els.transcript.scrollTop) {
  const entries = state.scrubEntries;
  if (!entries.length) return null;
  let best = entries[0];
  let bestDist = Infinity;
  for (const entry of entries) {
    const top = scrubScrollTopFor(entry.el);
    const d = Math.abs(top - scrollTop);
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  return best;
}

/** Short tick on phones that expose Vibration API (Android Chrome; iOS no-ops). */
function scrubBuzz() {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* ignore */
  }
}

/** How close (in rail pixels) the finger must be before the magnet pulls. */
const SCRUB_SNAP_PX = 14;

function snapScrubToEntry(entry, { buzz = true } = {}) {
  if (!entry) return;
  const t = els.transcript;
  const prev = t.style.scrollBehavior;
  t.style.scrollBehavior = 'auto';
  t.scrollTop = scrubScrollTopFor(entry.el);
  t.style.scrollBehavior = prev;
  if (buzz && state.scrubSnapEl !== entry.el) {
    state.scrubSnapEl = entry.el;
    scrubBuzz();
  } else {
    state.scrubSnapEl = entry.el;
  }
  syncScrubHandle();
  syncScrubActive();
}

function scrubStepLandmark(dir) {
  const entries = state.scrubEntries;
  if (!entries.length) return;
  let idx = entries.findIndex((e) => e.el === state.scrubSnapEl);
  if (idx < 0) {
    const cur = nearestScrubEntryByScrollTop();
    idx = Math.max(0, entries.indexOf(cur));
  }
  const next = entries[Math.max(0, Math.min(entries.length - 1, idx + dir))];
  snapScrubToEntry(next);
}

function syncScrubHandle() {
  const ratio = scrubLayoutRatio();
  const pct = `${ratio * 100}%`;
  if (els.scrubHandle) {
    els.scrubHandle.style.top = pct;
    els.scrubHandle.setAttribute('aria-valuemin', '0');
    els.scrubHandle.setAttribute('aria-valuemax', '100');
    els.scrubHandle.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    els.scrubHandle.setAttribute('role', 'slider');
  }
  return ratio;
}

function syncScrubActive() {
  layoutScrubWheel();
}

function setScrubMode(mode) {
  if (!els.scrub) return;
  els.scrub.dataset.mode = mode;
  if (els.scrubTimeline) {
    const open = mode === 'scrub';
    els.scrubTimeline.hidden = !open;
    els.scrubTimeline.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
}

/** Hint mode: handle only, while scrolling a long chat. */
function showScrubHint() {
  if (!els.scrub || !scrubWorthShowing()) {
    hideScrub(true);
    return;
  }
  els.scrub.hidden = false;
  els.scrub.dataset.active = '1';
  if (!state.scrubbing) setScrubMode('hint');
  syncScrubHandle();
  clearTimeout(state.scrubHide);
  if (!state.scrubbing) {
    // Dock to a right-edge peek — do not remove from the pane.
    state.scrubHide = setTimeout(() => hideScrub(), 1400);
  }
}

/** Scrub mode: expand labeled timeline left of the thumb. */
function enterScrubMode() {
  if (!els.scrub || !scrubWorthShowing()) return;
  state.scrubbing = true;
  state.scrubSnapEl = null;
  clearTimeout(state.scrubHide);
  els.scrub.hidden = false;
  els.scrub.dataset.active = '1';
  els.toBottom.hidden = true;
  if (state.scrubTimelineDirty) rebuildScrubTimeline();
  setScrubMode('scrub');
  syncScrubHandle();
  syncScrubActive();
}

function leaveScrubMode() {
  if (!state.scrubbing) return;
  state.scrubbing = false;
  state.scrubPointer = false;
  state.scrubDriveRatio = null;
  state.scrubSnapEl = null;
  setScrubMode('hint');
  // Rebuild so secondary pills regain their resting tops/widths.
  state.scrubTimelineDirty = true;
  syncToBottom();
  state.scrubHide = setTimeout(() => hideScrub(), 900);
}

/**
 * Idle = docked peek on the right edge. Force tears it down (short chat /
 * session switch). Tapping the peek or scrolling slides it back out.
 */
function hideScrub(force = false) {
  if (!els.scrub) return;
  if (state.scrubbing && !force) return;
  clearTimeout(state.scrubHide);
  state.scrubHide = null;
  delete els.scrub.dataset.active;
  setScrubMode('hint');
  if (force || !scrubWorthShowing()) {
    state.scrubbing = false;
    state.scrubPointer = false;
    state.scrubDriveRatio = null;
    els.scrub.hidden = true;
  }
}

function onTranscriptScroll() {
  if (state.scrubbing) {
    els.toBottom.hidden = true;
    syncScrubHandle();
    syncScrubActive();
    return;
  }
  els.toBottom.hidden = nearBottom();
  if (state.replaying) return;
  showScrubHint();
}

function scrubToClientY(clientY) {
  const t = els.transcript;
  if (!t || !els.scrub) return;
  const rect = els.scrub.getBoundingClientRect();
  const pad = 24;
  const usable = Math.max(1, rect.height - pad * 2);
  const ratio = Math.min(1, Math.max(0, (clientY - rect.top - pad) / usable));
  // Labels and the grip follow the finger; chat may still snap underneath.
  state.scrubDriveRatio = ratio;
  const max = Math.max(0, t.scrollHeight - t.clientHeight);
  const prev = t.style.scrollBehavior;
  t.style.scrollBehavior = 'auto';

  // Rail bottom = true chat bottom (not "last landmark mid-view"), so ↓
  // stays hidden because we are actually there.
  if ((1 - ratio) * usable <= SCRUB_SNAP_PX) {
    t.scrollTop = max;
    if (state.scrubSnapEl !== els.transcript) {
      state.scrubSnapEl = els.transcript;
      scrubBuzz();
    }
    t.style.scrollBehavior = prev;
    syncScrubHandle();
    syncScrubActive();
    return;
  }

  const entries = state.scrubEntries;
  if (entries.length) {
    const entry = entries[activeScrubIndex(ratio)];
    if (entry && state.scrubSnapEl !== entry.el) {
      state.scrubSnapEl = entry.el;
      scrubBuzz();
    } else if (entry) {
      state.scrubSnapEl = entry.el;
    }
    // Active pill on the wheel → that landmark's message at the viewport top.
    t.scrollTop = scrubScrollTopFor(entry.el);
  } else {
    t.scrollTop = ratio * max;
  }
  t.style.scrollBehavior = prev;
  syncScrubHandle();
  syncScrubActive();
}

function bindScrubber() {
  const handle = els.scrubHandle;
  if (!handle) return;

  const start = (e) => {
    if (!scrubWorthShowing()) return;
    e.preventDefault();
    state.scrubPointer = true;
    enterScrubMode();
    scrubToClientY(e.clientY);
    handle.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!state.scrubbing) return;
    e.preventDefault();
    scrubToClientY(e.clientY);
  };
  const end = () => {
    if (!state.scrubbing) return;
    state.scrubPointer = false;
    state.scrubDriveRatio = null;
    leaveScrubMode();
  };

  handle.addEventListener('pointerdown', start);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('lostpointercapture', end);

  handle.addEventListener('keydown', (e) => {
    const t = els.transcript;
    const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    enterScrubMode();
    if (state.scrubTimelineDirty) rebuildScrubTimeline();
    const entries = state.scrubEntries;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      scrubStepLandmark(1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      scrubStepLandmark(-1);
    } else if (e.key === 'Home' && entries[0]) {
      snapScrubToEntry(entries[0]);
    } else if (e.key === 'End') {
      const max = Math.max(0, t.scrollHeight - t.clientHeight);
      t.style.scrollBehavior = 'auto';
      t.scrollTop = max;
      syncScrubHandle();
      syncScrubActive();
    } else {
      syncScrubHandle();
      syncScrubActive();
    }
    clearTimeout(state.scrubHide);
    state.scrubHide = setTimeout(() => leaveScrubMode(), 1200);
  });
}

/** Timeline goes stale whenever the transcript gains or loses a landmark. */
function markScrubDirty() {
  state.scrubTimelineDirty = true;
}

/**
 * Fold away the thinking once it has stopped.
 *
 * Reasoning is worth reading while it is the only thing happening and worth
 * getting out of the way the moment anything else is, so a thinking block is
 * born open and closed by whatever comes next — including the end of the turn,
 * which lands here too. A live spell of it is timed the way Cursor's is, so
 * the summary becomes "Thought for 8s" rather than staying "Thinking".
 */
function closeThinking() {
  if (!state.thinking) return;
  const given = Number(state.thinking.dataset.duration || 0);
  const started = Number(state.thinking.dataset.started || 0);
  const at = state.now || Date.now();
  const ms = given > 0 ? given : started ? at - started : 0;
  const sum = state.thinking.querySelector('summary');
  if (sum) sum.textContent = thoughtLabel(ms);
  state.thinking.open = false;
  state.thinking = null;
  syncPhase();
}

function nSpan(n) {
  const s = document.createElement('span');
  s.className = 'n';
  s.textContent = String(n);
  return s;
}

/** Draw a status line the way Cursor does: quiet words, loud counts. */
function paintParts(el, parts) {
  if (!el) return;
  el.replaceChildren(
    ...(parts || []).map((p) => {
      if (p.n == null) return document.createTextNode(p.t);
      return nSpan(p.n);
    }),
  );
}

/**
 * What a quiet turn did, as parts: "Explored 3 files, 1 search · Edited 2
 * files · Ran 1 command". Quiet does not list steps; this is the whole row.
 */
function turnStatsParts(stats) {
  if (!stats) return [];
  const groups = [];
  if (stats.files || stats.searches) {
    groups.push(activityCopy({ files: stats.files, searches: stats.searches, running: false }).parts);
  }
  if (stats.browsers) {
    groups.push([
      { n: stats.browsers },
      { t: stats.browsers === 1 ? ' browser action' : ' browser actions' },
    ]);
  }
  if (stats.edits) {
    groups.push([{ t: 'Edited ' }, { n: stats.edits }, { t: stats.edits === 1 ? ' file' : ' files' }]);
  }
  if (stats.commands) {
    groups.push([{ t: 'Ran ' }, { n: stats.commands }, { t: stats.commands === 1 ? ' command' : ' commands' }]);
  }
  if (!groups.length && stats.other) {
    groups.push([{ t: 'Used ' }, { n: stats.other }, { t: stats.other === 1 ? ' tool' : ' tools' }]);
  }
  const out = [];
  for (const [i, group] of groups.entries()) {
    if (i) out.push({ t: ' · ' });
    out.push(...group);
  }
  return out;
}

function stopTurnClock() {
  if (!state.turnClock) return;
  clearInterval(state.turnClock);
  state.turnClock = null;
}

/** Quiet has no tool rows, so the live parent is built from the turn tally. */
function quietLiveParts() {
  const stats = state.turn?.stats;
  if (!stats) return [];
  const fake = [];
  for (let i = 0; i < (stats.edits || 0); i += 1) fake.push({ title: 'edit_file_v2', status: 'completed' });
  for (let i = 0; i < (stats.files || 0); i += 1) fake.push({ title: 'read_file_v2', status: 'completed' });
  for (let i = 0; i < (stats.searches || 0); i += 1) {
    fake.push({ title: 'ripgrep_raw_search', status: 'completed' });
  }
  for (let i = 0; i < (stats.browsers || 0); i += 1) fake.push({ title: 'browser_navigate', status: 'completed' });
  for (let i = 0; i < (stats.commands || 0); i += 1) {
    fake.push({ title: 'run_terminal_command_v2', rawInput: { command: 'x' }, status: 'completed' });
  }
  if (!fake.length) return [];
  return workCopy(fake, { live: true }).parts;
}

/** The one line at the bottom while a turn has not started a work fold yet. */
function liveSummaryParts() {
  if (state.verbosity === 'quiet') {
    const extra = quietLiveParts();
    if (extra.length) return extra;
  }
  if (state.thinking) return [{ t: 'Thinking' }];
  return [{ t: 'Planning next moves' }];
}

function phaseList() {
  if (state.bundle?.card?.isConnected) return state.bundle.card.querySelector('.bundle-list');
  if (state.liveFold?.isConnected) return state.liveFold.querySelector('.beats');
  return null;
}

/**
 * Thinking and Planning next moves sit under the work summary. Each is one
 * line until it is opened. Planning shows between steps; a running tool or
 * a live thought takes its place.
 */
function syncPhase() {
  if (state.replaying || !state.turn || state.bundle?.settled) return;
  const list = phaseList();
  if (!list) return;
  const busy = state.bundle?.items?.some((it) => {
    const s = it.rec?.status || 'completed';
    return s === 'in_progress' || s === 'pending';
  });
  const show = !state.thinking && !busy;
  let plan = list.querySelector(':scope > .beat.planning');
  if (!show) {
    plan?.remove();
    return;
  }
  if (!plan) {
    plan = document.createElement('details');
    plan.className = 'beat planning';
    plan.innerHTML = '<summary><span class="line">Planning next moves</span></summary><div class="body"></div>';
    list.append(plan);
  } else {
    list.append(plan);
  }
}

function ensureLiveFold() {
  if (state.bundle?.card?.isConnected) return null;
  if (state.liveFold?.isConnected) return state.liveFold;
  const el = document.createElement('details');
  el.className = 'turn-live live';
  el.innerHTML = '<summary><span class="label"></span></summary><div class="beats"></div>';
  state.liveFold = el;
  state.statusEl = el;
  return el;
}

/** While the turn runs, keep the summary at the bottom. The anchor is where it rests once the turn ends. */
function parkBundle(bundle) {
  if (!bundle?.card?.isConnected || state.replaying || !state.turn || bundle.settled) return;
  if (!bundle.anchor) {
    const anchor = document.createElement('span');
    anchor.className = 'bundle-anchor';
    bundle.card.after(anchor);
    bundle.anchor = anchor;
  }
  els.transcript.appendChild(bundle.card);
}

function unparkBundle(bundle) {
  if (!bundle?.anchor?.isConnected || !bundle.card) return;
  bundle.anchor.replaceWith(bundle.card);
  bundle.anchor = null;
}

function pinLive() {
  if (state.replaying || !state.turn) return;
  if (state.bundle?.card?.isConnected && !state.bundle.settled) {
    parkBundle(state.bundle);
    return;
  }
  if (state.liveFold?.isConnected) els.transcript.appendChild(state.liveFold);
}

function retireLiveFold() {
  const el = state.liveFold;
  state.liveFold = null;
  if (state.statusEl === el) state.statusEl = null;
  if (!el?.isConnected) return;
  const beats = el.querySelector('.beats');
  if (beats) {
    for (const child of [...beats.children]) {
      if (child.classList.contains('planning')) child.remove();
      else el.before(child);
    }
  }
  el.remove();
}

/**
 * The line that says the turn is still going.
 *
 * Cursor writes "Worked for 7m 3s" / "Thought for 1s" above the answer. While
 * the turn is live the bottom line is the work summary ("Editing 9 files, …")
 * with a chevron, or "Thinking" / "Planning next moves" before any step.
 */
function paintLiveStatus() {
  if (state.replaying || !state.turn) return;
  if (state.bundle?.card?.isConnected) {
    paintBundle(state.bundle);
    syncPhase();
    parkBundle(state.bundle);
    retireLiveFold();
    scrollDown();
    return;
  }
  const el = ensureLiveFold();
  paintParts(el.querySelector('.label'), liveSummaryParts());
  syncPhase();
  els.transcript.appendChild(el);
  scrollDown();
}

function dropLiveStatus() {
  stopTurnClock();
  if (state.bundle?.card && !state.replaying) {
    state.bundle.card.querySelectorAll('.beat.planning').forEach((n) => n.remove());
    if (!state.bundle.settled) {
      state.bundle.settled = true;
      paintBundle(state.bundle);
    }
    unparkBundle(state.bundle);
  }
  retireLiveFold();
  if (state.statusEl?.classList.contains('live')) {
    state.statusEl.remove();
    state.statusEl = null;
  }
}

function beginTurn(rec) {
  state.turn = {
    started: rec.ts || state.now || Date.now(),
    worked: false,
    answer: null,
    stats: { files: 0, searches: 0, edits: 0, commands: 0, browsers: 0, other: 0 },
  };
  // Quiet folds a whole turn's reasoning into one block; a new turn gets its own.
  state.quietThinking = null;
  state.liveFold = null;
  paintLiveStatus();
}

function endTurn(rec) {
  stopTurnClock();
  // A turn that was pulled back into the composer has nothing left to summarise.
  if (rec?.interrupted || state.withdrawnTurn) {
    state.withdrawnTurn = false;
    settleRunningTools();
    closeThinking();
    dropLiveStatus();
    state.turn = null;
    return;
  }
  settleRunningTools();
  closeThinking();
  dropLiveStatus();
  if (state.streamBody) state.streamBody.style.minHeight = '';
  if (state.stream?.classList?.contains('agent')) syncAgentMdCopy(state.stream);
  const started = state.turn?.started || rec.ts;
  const durationMs =
    rec.durationMs > 0 ? rec.durationMs : rec.ts && started ? rec.ts - started : 0;
  const worked = Boolean(state.turn?.worked);
  const el = div('turn-status');
  const parts = turnCopy({ durationMs, worked }).parts;
  // A finished job always says what it did. Quiet hides the tool rows, so the
  // tally is the only description there; at other levels the agent's own answer
  // carries it, and the tally is only added when it said nothing.
  const extra = turnStatsParts(state.turn?.stats);
  if (extra.length && (state.verbosity === 'quiet' || !state.turn?.answer)) {
    parts.push({ t: ' · ' }, ...extra);
  }
  paintParts(el, parts);
  const answer = state.turn?.answer;
  if (answer?.isConnected) answer.before(el);
  else if (!el.isConnected) add(el, { keepStream: true });
  const recs = state.turn?.fileRecs || [];
  // A cache paint settles an unfinished turn without a real turn_end. The
  // file list belongs to the finished turn, so wait for that record.
  if (recs.length && rec?.kind === 'turn_end') publishFiles(recs);
  state.statusEl = null;
  state.turn = null;
  decorate(els.transcript);
}

/**
 * Nothing can be running in an idle chat. Cards left "running…" after a
 * restart or a missed tool_update contradicted the idle chip, which is how
 * a finished turn looked unfinished.
 */
function settleRunningTools() {
  for (const card of els.transcript.querySelectorAll('.tool.running')) {
    card.classList.remove('running');
    card.classList.add('done');
    const word = card.querySelector('summary .state');
    if (word) word.textContent = 'stopped';
    if (!card.dataset.opened) card.open = false;
  }
  if (!state.bundle) return;
  for (const it of state.bundle.items) {
    if (!it.row) continue;
    const s = it.rec.status;
    if (s === 'in_progress' || s === 'pending') {
      it.rec.status = 'cancelled';
      paintItemStatus(it.row, 'cancelled', false);
    }
  }
  paintBundle(state.bundle);
}

function add(node, { keepStream = false } = {}) {
  if (!keepStream) {
    // Stream is closing — drop the height pin and offer the markdown copy
    // icon before we drop the pointer (tools/notices arrive without keepStream).
    if (state.streamBody) state.streamBody.style.minHeight = '';
    if (state.stream?.classList?.contains('agent')) syncAgentMdCopy(state.stream);
    closeThinking();
    state.stream = null;
    state.streamKind = null;
    state.streamBody = null;
  }
  const stick = nearBottom();
  els.transcript.appendChild(node);
  // The live summary stays at the bottom of the stream, after whatever just
  // arrived — otherwise the last thing you see is a finished command.
  pinLive();
  decorate(node);
  scrollDown(stick);
  syncToBottom();
  markScrubDirty();
  return node;
}

function div(cls, html) {
  const d = document.createElement('div');
  d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

// ----------------------------------------------------------------- renderers

function renderUser(rec) {
  const node = div('msg user');
  if (rec.text) {
    const text = document.createElement('div');
    text.className = 'user-text';
    text.innerHTML = linkify(esc(rec.text));
    node.append(text);
  }
  const parts = imagePartsOf(rec);
  if (parts.length) {
    const thumbs = div('thumbs');
    for (const part of parts) {
      const src = srcOfPart(part);
      if (!src) continue;
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Attached image';
      img.loading = 'lazy';
      img.onclick = () => openLightbox(src);
      thumbs.append(img);
    }
    node.append(thumbs);
  } else if (imageCount(rec)) {
    const cap = div('cap');
    const n = imageCount(rec);
    cap.textContent = `${n} image${n === 1 ? '' : 's'} attached`;
    node.append(cap);
  }
  add(node);
}

/** Parts carried on the record, or a bare count for older transcripts. */
function imagePartsOf(rec) {
  if (Array.isArray(rec?.imageParts) && rec.imageParts.length) return rec.imageParts;
  if (Array.isArray(rec?.images) && rec.images.length && typeof rec.images[0] === 'object') {
    return rec.images;
  }
  return [];
}

function srcOfPart(part) {
  if (part?.url) return part.url;
  if (part?.data) return `data:${part.mimeType || 'image/png'};base64,${part.data}`;
  return '';
}

/** Same words already drawn for this send, so the host record is not a second bubble. */
function sameSend(a, b) {
  return (
    String(a?.text || '').trim() === String(b?.text || '').trim() &&
    imageCount(a) === imageCount(b)
  );
}

function imageCount(rec) {
  if (typeof rec?.images === 'number') return rec.images;
  if (Array.isArray(rec?.imageParts)) return rec.imageParts.length;
  if (Array.isArray(rec?.images)) return rec.images.length;
  return 0;
}

/**
 * An idle send is drawn at once; the host later writes the same user_message,
 * and Cursor may echo it again. Each credit swallows one matching record.
 */
function rememberSend(rec) {
  const now = Date.now();
  state.pendingEchoes = state.pendingEchoes.filter((e) => now - e.at < 120_000);
  state.pendingEchoes.push({
    sessionId: state.sessionId,
    text: String(rec.text || ''),
    images: imageCount(rec),
    left: 2,
    at: now,
  });
}

function takePendingEcho(rec) {
  const now = Date.now();
  state.pendingEchoes = state.pendingEchoes.filter((e) => now - e.at < 120_000);
  const hit = state.pendingEchoes.find(
    (e) => e.sessionId === state.sessionId && e.left > 0 && sameSend(e, rec),
  );
  if (!hit) return false;
  hit.left -= 1;
  if (hit.left <= 0) {
    state.pendingEchoes = state.pendingEchoes.filter((e) => e !== hit);
  }
  return true;
}

/**
 * Keep what you were typing with the chat it belongs to. Switching used to
 * carry the same words into the next box. The host also holds the draft so
 * the computer and the phone can share it.
 */
function saveDraft(sessionId = state.sessionId) {
  if (!sessionId) return;
  const text = els.box.value;
  if (!text && !state.attachments.length) {
    state.drafts.delete(sessionId);
  } else {
    state.drafts.set(sessionId, {
      text,
      attachments: state.attachments.slice(),
    });
  }
  if (sessionId !== state.sessionId || state.draftApplying) return;
  state.draftAt = Date.now();
  clearTimeout(state.draftTimer);
  // Short pause so a fast burst becomes one write; the host still coalesces
  // overlapping writes if another keystroke lands before CDP finishes.
  state.draftTimer = setTimeout(() => {
    if (state.sessionId !== sessionId) return;
    const at = Date.now();
    state.draftAt = Math.max(state.draftAt, at);
    sendOp({
      op: 'session.draft',
      sessionId,
      text: els.box.value,
      at,
    });
  }, 120);
}

function loadDraft(sessionId) {
  clearTimeout(state.draftTimer);
  const draft = sessionId ? state.drafts.get(sessionId) : null;
  state.draftApplying = true;
  els.box.value = draft?.text || '';
  state.attachments = draft?.attachments ? draft.attachments.slice() : [];
  state.draftAt = Date.now();
  state.draftApplying = false;
  renderAttachments();
  autosize();
}

/** Words waiting in Cursor's box, or typed on another phone. */
function applyRemoteDraft(draft) {
  if (!draft || draft.sessionId !== state.sessionId) return;
  const text = String(draft.text ?? '');
  const at = Number(draft.at) || 0;
  if (at && at < state.draftAt) return;
  // While this box is being typed into, a lagging computer echo must not
  // yank the caret back to an older prefix.
  if (
    draft.source !== 'clear' &&
    document.activeElement === els.box &&
    Date.now() - state.draftAt < 2000
  ) {
    return;
  }
  if (els.box.value === text) {
    state.draftAt = Math.max(state.draftAt, at);
    return;
  }
  // Keep the caret where it was when the remote change is only a longer
  // prefix — otherwise every sync yank the cursor to the end.
  const was = els.box.value;
  const start = els.box.selectionStart;
  const end = els.box.selectionEnd;
  state.draftApplying = true;
  els.box.value = text;
  state.draftAt = Math.max(at, Date.now());
  state.draftApplying = false;
  if (document.activeElement === els.box) {
    const stillPrefix = text.startsWith(was) || was.startsWith(text);
    if (stillPrefix) {
      const next = Math.min(start, text.length);
      const nextEnd = Math.min(end, text.length);
      try {
        els.box.setSelectionRange(next, nextEnd);
      } catch {
        /* some browsers refuse on empty */
      }
    } else {
      const tip = text.length;
      try {
        els.box.setSelectionRange(tip, tip);
      } catch {
        /* ignore */
      }
    }
  }
  if (state.sessionId) {
    if (!text && !state.attachments.length) state.drafts.delete(state.sessionId);
    else {
      state.drafts.set(state.sessionId, {
        text,
        attachments: state.attachments.slice(),
      });
    }
  }
  autosize();
  els.send.disabled = !(els.box.value.trim() || state.attachments.length);
}

function clearDraft(sessionId = state.sessionId) {
  if (sessionId) state.drafts.delete(sessionId);
  if (sessionId === state.sessionId) state.draftAt = Date.now();
}

function renderStreaming(rec) {
  const isThought = rec.kind === 'agent_thought';
  if (isThought && rec.durationMs && state.thinking) {
    state.thinking.dataset.duration = String(rec.durationMs);
  }
  if (isThought && !rec.text && rec.durationMs) {
    const el =
      state.thinking ||
      (rec.desktopBubbleId
        ? els.transcript.querySelector(`details.think[data-bubble="${CSS.escape(rec.desktopBubbleId)}"]`)
        : null);
    if (el) {
      el.dataset.duration = String(rec.durationMs);
      if (el !== state.thinking) {
        const sum = el.querySelector('summary');
        if (sum) sum.textContent = thoughtLabel(rec.durationMs);
      }
    }
    return;
  }
  if (!state.stream || state.streamKind !== rec.kind) {
    state.streamKind = rec.kind;
    if (isThought) {
      // Quiet folds every spell of reasoning in the turn into the one block:
      // how many times it paused to think is not what a phone needs to know,
      // only that it thought and for how long.
      const reuseQuiet = state.verbosity === 'quiet' && state.quietThinking?.isConnected;
      if (reuseQuiet) {
        const d = state.quietThinking;
        // A fresh run: time this spell from here, and keep the earlier total.
        d.dataset.started = String(rec.ts || Date.now());
        if (rec.desktopBubbleId) d.dataset.bubble = rec.desktopBubbleId;
        if (rec.durationMs) d.dataset.duration = String(rec.durationMs);
        const sum = d.querySelector('summary');
        if (sum) sum.textContent = 'Thinking';
        d.open = d.dataset.userOpen === '1';
        state.thinking = d;
        state.stream = d.querySelector('.body');
        state.streamBody = null;
        syncPhase();
      } else {
        const d = document.createElement('details');
        d.className = 'think beat';
        d.innerHTML = '<summary><span class="line">Thinking</span></summary><div class="body"></div>';
        // One line until tapped. The parent summary is the sign of life.
        d.open = false;
        d.dataset.started = String(rec.ts || Date.now());
        if (rec.desktopBubbleId) d.dataset.bubble = rec.desktopBubbleId;
        if (rec.durationMs) d.dataset.duration = String(rec.durationMs);
        d.querySelector('summary').addEventListener('click', () => {
          d.dataset.userOpen = '1';
        });
        state.thinking = d;
        if (state.verbosity === 'quiet') state.quietThinking = d;
        // Once this turn has a work fold, later thoughts sit inside it,
        // the way Cursor tucks "Thought 5s" between the Ran and Edited rows.
        if (!state.bundle && state.turn && !state.replaying) paintLiveStatus();
        const list = phaseList();
        if (list) list.appendChild(d);
        else add(d, { keepStream: true });
        syncPhase();
        state.stream = d.querySelector('.body');
        state.streamBody = null;
        state.stream.dataset.raw = '';
      }
    } else {
      // Body holds rendered HTML; the outer bubble keeps data-raw + the copy
      // footer. Rewriting innerHTML on the outer node would destroy the button.
      const d = div('msg agent');
      const body = div('agent-body');
      d.append(body);
      closeThinking();
      add(d, { keepStream: true });
      if (state.turn && !state.turn.answer) state.turn.answer = d;
      state.stream = d;
      state.streamBody = body;
      state.stream.dataset.raw = '';
    }
  }
  const stick = nearBottom();
  // A desktop rewrite replaces the bubble; appending would stutter the answer.
  if (rec.replace) {
    state.stream.dataset.raw = rec.text || '';
    if (state.streamBody) state.streamBody.style.minHeight = '';
  } else {
    state.stream.dataset.raw += rec.text || '';
  }
  if (isThought) {
    state.stream.textContent = state.stream.dataset.raw;
  } else {
    const body = state.streamBody || state.stream.querySelector(':scope > .agent-body') || state.stream;
    // Incomplete markdown (open fence, half a table) briefly collapses then
    // grows — pin the floor so the pane does not jump up under the reader.
    const floor = Math.max(body.offsetHeight, parseFloat(body.style.minHeight) || 0);
    body.innerHTML = markdown(state.stream.dataset.raw);
    body.style.minHeight = `${Math.max(floor, body.offsetHeight)}px`;
    enrichMarkdown(body);
  }
  // The first sentence of the answer stays above the work fold. Later
  // sentences stay below it, and later steps keep joining the same fold.
  if (!isThought && state.bundle && !state.bundle.placed && state.stream) {
    state.stream.after(state.bundle.card);
    state.bundle.placed = true;
    if (state.bundle.anchor?.isConnected) state.bundle.card.after(state.bundle.anchor);
  }
  if (!isThought && state.bundle && state.turn && !state.replaying && !state.bundle.settled) {
    parkBundle(state.bundle);
  }
  scrollDown(stick);
}

/**
 * ACP attaches richer content to tool calls than the raw input/output JSON:
 * file diffs, and images such as browser screenshots. Rendering these is what
 * makes an edit or a page visit legible at a glance.
 */
function renderContent(body, blocks, card) {
  for (const block of blocks || []) {
    if (!block) continue;

    if (block.type === 'diff') {
      body.appendChild(renderDiff(block));
      // A diff is the point of an edit, so never make the reader open it.
      if (card) {
        card.open = true;
        const label = card.querySelector('.label');
        if (label) label.textContent = (block.path || '').split(/[\\/]/).pop() || label.textContent;
      }
      continue;
    }

    if (block.type === 'content' && block.content?.type === 'image' && card) card.open = true;

    if (block.type === 'terminal') {
      const note = div('cap');
      note.textContent = `terminal ${block.terminalId || ''}`;
      body.appendChild(note);
      continue;
    }

    const inner = block.type === 'content' ? block.content : block;
    if (!inner) continue;

    if (inner.type === 'image' && inner.data) {
      const fig = div('shot');
      const img = document.createElement('img');
      img.src = `data:${inner.mimeType || 'image/png'};base64,${inner.data}`;
      img.alt = 'screenshot';
      img.loading = 'lazy';
      img.onclick = () => openLightbox(img.src);
      fig.appendChild(img);
      body.appendChild(fig);
    } else if (inner.type === 'text' && inner.text) {
      body.appendChild(div('cap', 'content'));
      const pre = document.createElement('pre');
      pre.innerHTML = `<code>${esc(inner.text)}</code>`;
      body.appendChild(pre);
    } else if (inner.type === 'resource_link' && inner.uri) {
      const p = div('cap');
      const a = document.createElement('a');
      a.href = inner.uri;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = inner.name || inner.uri;
      p.appendChild(a);
      body.appendChild(p);
    }
  }
}

/**
 * For a newly created file the agent puts unified-diff headers inside the
 * text itself (`-- /dev/null`, `++ b/path`); they are metadata, not content.
 * The marker arrives with two characters rather than the usual three.
 */
function stripDiffHeaders(oldText, newText) {
  const old = String(oldText ?? '');
  const neu = String(newText ?? '');
  const isNew = /^-{2,3} \/dev\/null/.test(old) && /^\+{2,3} /.test(neu);
  if (!isNew) return { oldText: old, newText: neu, isNew: false };
  return {
    oldText: old.split('\n').slice(1).join('\n'),
    newText: neu.split('\n').slice(1).join('\n'),
    isNew: true,
  };
}

function renderDiff(block) {
  const { oldText, newText, isNew } = stripDiffHeaders(block.oldText, block.newText);
  const rows = collapseContext(lineDiff(oldText, newText));
  const { added, removed } = diffStats(rows);

  const wrap = document.createElement('details');
  wrap.className = 'diff';
  wrap.open = true;
  wrap.innerHTML = `
    <summary>
      <span class="path"></span>
      ${isNew ? '<span class="tag">new</span>' : ''}
      <span class="stat"><span class="plus">+${added}</span> <span class="minus">−${removed}</span></span>
    </summary>`;
  wrap.querySelector('.path').textContent = (block.path || '').split(/[\\/]/).slice(-2).join('/');

  const pre = document.createElement('pre');
  pre.className = 'diff-body';
  for (const r of rows) {
    const line = document.createElement('div');
    line.className = `dl ${r.type}`;
    line.textContent = `${r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '} ${r.text}`;
    pre.appendChild(line);
  }
  wrap.appendChild(pre);
  return wrap;
}

/** Human-friendly one-liner for a tool call. */
function toolLabel(rec) {
  return displayLabel(rec);
}

function statusWord(status, failed) {
  if (failed || status === 'failed') return 'failed';
  if (status === 'cancelled') return 'stopped';
  if (status === 'completed') return 'done';
  if (status === 'in_progress' || status === 'pending') return 'running…';
  return String(status || 'running…').replace('_', ' ');
}

function paintItemStatus(row, status, failed) {
  row.classList.toggle('failed', Boolean(failed) || status === 'failed');
  row.classList.toggle('done', status === 'completed' && !failed);
  const stateEl = row.querySelector('.state');
  if (stateEl) stateEl.textContent = status === 'completed' && !failed ? '' : statusWord(status, failed);
}

function statHtml(stats) {
  if (!stats) return '';
  const bits = [];
  if (stats.added) bits.push(`<span class="plus">+${stats.added}</span>`);
  if (stats.removed) bits.push(`<span class="minus">−${stats.removed}</span>`);
  return bits.join(' ');
}

/** A file change shows its diff and nothing else; other lanes keep every block. */
function visibleBlocks(ui, blocks) {
  const all = blocks || [];
  if (ui?.lane !== 'fileChange') return all;
  return all.filter((b) => b?.type === 'diff');
}

function bundleSummary(bundle) {
  const items = bundle.items;
  let added = 0;
  let removed = 0;
  let saw = false;
  for (const it of items) {
    const s = fileStats(it.rec);
    if (!s) continue;
    added += s.added;
    removed += s.removed;
    saw = true;
  }
  const live = Boolean(state.turn) && !state.replaying && !bundle.settled;
  return {
    ...workCopy(
      items.map((it) => ({ rec: it.rec, status: it.rec.status, ui: it.ui })),
      { live },
    ),
    stats: saw ? { added, removed } : null,
  };
}

function paintBundle(bundle) {
  const { card } = bundle;
  const { label, parts, stats } = bundleSummary(bundle);
  paintParts(card.querySelector('summary .label'), parts || [{ t: label }]);
  const statEl = card.querySelector('summary .stat');
  if (statEl) statEl.innerHTML = statHtml(stats);
  let status = 'completed';
  let failed = false;
  for (const it of bundle.items) {
    const s = it.rec.status || 'completed';
    if (s === 'in_progress' || s === 'pending') status = 'in_progress';
    else if (s === 'failed') failed = true;
    else if (s === 'cancelled' && status !== 'in_progress') status = 'cancelled';
  }
  if (status === 'in_progress') {
    card.classList.add('running');
    card.classList.remove('done', 'failed');
  } else {
    card.classList.remove('running');
    card.classList.remove('failed');
    card.classList.toggle('done', !failed);
    if (!failed && !card.dataset.opened) card.open = false;
  }
  const items = bundle.items;
  const mixed = items.some((it) => {
    const ui = it.ui || classifyTool(it.rec);
    return (
      ui.lane === 'fileChange' ||
      (ui.toolKind === 'execute' && ui.lane !== 'group') ||
      isBrowserTool(it.rec)
    );
  });
  for (const it of items) {
    if (!it.row) continue;
    it.row.hidden = mixed && it.row.classList.contains('explore');
  }
  const stateEl = card.querySelector('summary .state');
  if (stateEl) stateEl.textContent = status === 'in_progress' ? 'running…' : '';
  syncPhase();
}

function flushBundle() {
  state.bundle = null;
}

function startBundle(lane) {
  const card = document.createElement('details');
  card.className = 'tool bundle work';
  card.innerHTML = `
    <summary>
      <span class="row">
        <span class="kind"></span>
        <span class="label"></span>
        <span class="stat"></span>
        <span class="state">running…</span>
      </span>
    </summary>
    <div class="body bundle-list"></div>`;
  card.querySelector('summary').addEventListener('click', () => {
    card.dataset.opened = '1';
  });
  const list = card.querySelector('.bundle-list');
  const fold = state.liveFold;
  if (fold?.isConnected) {
    for (const child of [...fold.querySelectorAll('.beats > *')]) {
      if (!child.classList.contains('planning')) list.appendChild(child);
    }
    fold.replaceWith(card);
    if (state.statusEl === fold) state.statusEl = null;
    state.liveFold = null;
  } else {
    add(card);
  }
  state.bundle = { lane, card, items: [] };
  if (state.turn && !state.replaying) parkBundle(state.bundle);
  return state.bundle;
}

function asWork(ui, rec) {
  return (
    ui.lane === 'fileChange' ||
    ui.lane === 'group' ||
    ui.toolKind === 'execute' ||
    isBrowserTool(rec)
  );
}

function addBundleItem(rec, ui) {
  if (state.bundle?.lane !== 'work') {
    flushBundle();
    startBundle('work');
  }
  const { card } = state.bundle;
  const row = document.createElement('div');
  row.className = `bundle-row shut${stepShown(rec) ? '' : ' explore'}`;
  row.innerHTML = `
    <span class="row">
      <span class="kind"></span>
      <span class="name"></span>
      <span class="stat"></span>
      <span class="state">running…</span>
    </span>
    <div class="item-body"></div>`;
  row.querySelector('.name').textContent = displayLabel(rec);
  row.querySelector('.stat').innerHTML = statHtml(fileStats(rec));
  row.querySelector('.row').addEventListener('click', () => {
    row.classList.toggle('shut');
  });
  const body = row.querySelector('.item-body');
  // A file change is its diff; the agent's "Edit applied successfully." text
  // would just be a line of noise above it.
  renderContent(body, visibleBlocks(ui, rec.content), null);
  row.dataset.contentCount = String((rec.content || []).length);
  paintItemStatus(row, rec.status, rec.status === 'failed');
  card.querySelector('.bundle-list').appendChild(row);
  const item = { rec, ui, row };
  state.bundle.items.push(item);
  if (rec.toolCallId) state.toolCards.set(rec.toolCallId, { bundle: true, item, group: state.bundle });
  paintBundle(state.bundle);
}

/** Tally a quiet turn's work so its one-line summary can say what happened. */
function quietCountTool(ui, rec) {
  const stats = state.turn?.stats;
  if (!stats) return;
  if (ui.lane === 'fileChange') stats.edits += 1;
  else if (isBrowserTool(rec)) stats.browsers = (stats.browsers || 0) + 1;
  else if (ui.toolKind === 'search') stats.searches += 1;
  else if (ui.toolKind === 'read' || ui.lane === 'group') stats.files += 1;
  else if (ui.toolKind === 'execute') stats.commands += 1;
  else stats.other += 1;
}

/** Remember an edit so the turn can end with Cursor's "N Files Changed" card. */
function noteFileEdit(rec) {
  const id = rec.toolCallId;
  if (!id) return;
  // A path that arrives after the turn ended belongs on that turn's card,
  // even if a newer turn is already open.
  const home = state.fileHomes?.get(id);
  if (home) {
    const prev = home.recs.find((row) => row.toolCallId === id);
    if (prev) {
      if (rec.title) prev.title = rec.title;
      if (rec.toolKind) prev.toolKind = rec.toolKind;
      if (rec.rawInput) prev.rawInput = { ...prev.rawInput, ...rec.rawInput };
      if (rec.content) prev.content = rec.content;
      paintFilesHome(home);
    }
    return;
  }
  if (!state.turn) {
    // The replay window can start after turn_start. Still collect the edits
    // so the finished turn gets its file list.
    state.turn = {
      started: state.now || Date.now(),
      worked: true,
      answer: null,
      stats: { files: 0, searches: 0, edits: 0, commands: 0, other: 0 },
      fileRecs: [],
    };
  }
  const list = state.turn.fileRecs || (state.turn.fileRecs = []);
  const prev = list.find((row) => row.toolCallId === id);
  if (prev) {
    if (rec.title) prev.title = rec.title;
    if (rec.toolKind) prev.toolKind = rec.toolKind;
    if (rec.rawInput) prev.rawInput = { ...prev.rawInput, ...rec.rawInput };
    if (rec.content) prev.content = rec.content;
  } else if (classifyTool(rec).lane === 'fileChange') {
    list.push({
      kind: 'tool_call',
      toolCallId: id,
      title: rec.title,
      toolKind: rec.toolKind,
      rawInput: rec.rawInput,
      content: rec.content,
    });
  } else {
    return;
  }
}

function publishFiles(recs) {
  if (!recs?.length) return;
  const files = changedFiles(recs);
  const home = { recs, anchor: null, card: null };
  if (!state.fileHomes) state.fileHomes = new Map();
  for (const row of recs) if (row.toolCallId) state.fileHomes.set(row.toolCallId, home);
  if (files.length) {
    home.card = renderFilesChanged(files);
    add(home.card, { keepStream: true });
  } else {
    home.anchor = document.createElement('div');
    home.anchor.className = 'files-anchor';
    add(home.anchor, { keepStream: true });
  }
}

function paintFilesHome(home) {
  const files = changedFiles(home.recs);
  if (!files.length) return;
  const next = renderFilesChanged(files);
  if (home.card?.isConnected) home.card.replaceWith(next);
  else if (home.anchor?.isConnected) home.anchor.replaceWith(next);
  else add(next, { keepStream: true });
  home.card = next;
  home.anchor = null;
}

const FILES_PREVIEW = 4;

/** The card under a finished answer: how many files changed, and by how much. */
function renderFilesChanged(files) {
  const card = div('files-changed');
  const n = files.length;
  const head = div('files-head');
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = `${n} ${n === 1 ? 'File' : 'Files'} Changed`;
  const review = document.createElement('button');
  review.type = 'button';
  review.className = 'review';
  review.textContent = 'Review';
  head.append(count, review);
  const list = div('files-list');
  for (const [i, file] of files.entries()) {
    const row = div(i >= FILES_PREVIEW ? 'file-row extra' : 'file-row');
    const lang = document.createElement('span');
    lang.className = 'lang';
    lang.textContent = file.lang || '';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = file.name;
    const stat = document.createElement('span');
    stat.className = 'stat';
    stat.innerHTML = statHtml(file);
    row.append(lang, name, stat);
    if (i >= FILES_PREVIEW) row.hidden = true;
    list.append(row);
  }
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'more';
  const reveal = () => {
    list.querySelectorAll('.file-row.extra').forEach((row) => {
      row.hidden = false;
    });
    more.remove();
  };
  if (n > FILES_PREVIEW) {
    more.textContent = `Show ${n - FILES_PREVIEW} more`;
    more.onclick = reveal;
    list.append(more);
  }
  review.onclick = reveal;
  card.append(head, list);
  return card;
}

function renderToolCall(rec) {
  noteFileEdit(rec);
  const ui = classifyTool(rec);
  const level = state.verbosity;
  // Cursor hides a handful of internal bubbles; only verbose brings them back.
  if (ui.lane === 'hide' && level !== 'verbose') {
    if (rec.toolCallId) state.toolCards.set(rec.toolCallId, { hidden: true });
    return;
  }
  if (state.turn) state.turn.worked = true;

  // A Created Plan is actionable from the phone, so quiet still shows it.
  if (isCreatedPlan(rec)) {
    flushBundle();
    renderCreatedPlan(rec);
    return;
  }

  // Quiet is a summary: the turn's status line carries the tally, not the tool.
  if (level === 'quiet') {
    flushBundle();
    quietCountTool(ui, rec);
    if (rec.toolCallId) state.toolCards.set(rec.toolCallId, { hidden: true });
    if (state.turn && !state.replaying) paintLiveStatus();
    return;
  }

  closeThinking();
  state.stream = null;
  state.streamKind = null;
  state.streamBody = null;

  if (asWork(ui, rec)) {
    addBundleItem(rec, ui);
    return;
  }
  flushBundle();

  const card = document.createElement('details');
  card.className = 'tool';
  card.innerHTML = `
    <summary>
      <span class="row">
        <span class="kind">${esc(ui.toolKind || rec.toolKind || 'tool')}</span>
        <span class="label"></span>
        <span class="state">running…</span>
      </span>
      <pre class="peek" hidden></pre>
    </summary>
    <div class="body"></div>`;
  card.querySelector('.label').textContent = toolLabel(rec);

  const body = card.querySelector('.body');
  // The structured input is only for verbose: its braces bury the one useful
  // line, and what matters is already in the label (command, path, query).
  // Content blocks — diffs, images, text the agent chose to show — always come.
  if (level === 'verbose' && rec.rawInput && Object.keys(rec.rawInput).length) {
    const pre = document.createElement('pre');
    pre.innerHTML = `<code>${esc(JSON.stringify(rec.rawInput, null, 2))}</code>`;
    body.appendChild(div('cap', 'input'));
    body.appendChild(pre);
  }
  renderContent(body, rec.content, card);
  // Opening a card by hand means you want it open: it stays that way when the
  // command finishes, instead of folding itself up under your thumb.
  card.querySelector('summary').addEventListener('click', () => {
    card.dataset.opened = '1';
  });
  card.dataset.contentCount = String((rec.content || []).length);
  if (rec.toolCallId) state.toolCards.set(rec.toolCallId, card);
  add(card);

  // Replayed history arrives already finished, so the card is drawn once with
  // everything on it rather than growing as it did the first time.
  const failed = rec.status === 'failed';
  if (rec.status === 'completed' || failed) {
    card.classList.add(failed ? 'failed' : 'done');
    card.querySelector('.state').textContent = failed ? 'failed' : 'done';
  } else if (ui.toolKind === 'execute' || rec.toolKind === 'execute') {
    // A command that is still going is the one thing worth watching, so its
    // output is shown as it arrives instead of behind a tap.
    card.classList.add('running');
  }
  showOutput(card, rec.rawOutput, failed);
}

function renderToolUpdate(rec) {
  noteFileEdit(rec);
  const card = rec.toolCallId ? state.toolCards.get(rec.toolCallId) : null;
  if (!card || card.hidden) return;

  if (card.createdPlan) {
    paintCreatedPlan(card, {
      ...card.rec,
      ...rec,
      rawInput: rec.rawInput ? { ...card.rec.rawInput, ...rec.rawInput } : card.rec.rawInput,
      awaitingBuild: rec.awaitingBuild ?? card.rec.awaitingBuild,
    });
    return;
  }

  if (card.bundle) {
    const { item, group } = card;
    if (rec.title) item.rec = { ...item.rec, title: rec.title };
    if (rec.status) item.rec = { ...item.rec, status: rec.status };
    if (rec.rawInput) item.rec = { ...item.rec, rawInput: { ...item.rec.rawInput, ...rec.rawInput } };
    if (rec.rawOutput) item.rec = { ...item.rec, rawOutput: rec.rawOutput };
    if (rec.content) item.rec = { ...item.rec, content: rec.content };
    if (item.row) {
      item.row.classList.toggle('explore', !stepShown(item.rec));
      item.row.querySelector('.name').textContent = displayLabel(item.rec);
      item.row.querySelector('.stat').innerHTML = statHtml(fileStats(item.rec));
      const failed = rec.status === 'failed';
      if (rec.status) paintItemStatus(item.row, rec.status, failed);
      const blocks = rec.content || [];
      const seen = Number(item.row.dataset.contentCount || 0);
      if (blocks.length > seen) {
        const fresh = blocks.slice(seen).filter((b) => item.ui?.lane !== 'fileChange' || b?.type === 'diff');
        renderContent(item.row.querySelector('.item-body'), fresh, null);
        item.row.dataset.contentCount = String(blocks.length);
      }
    }
    paintBundle(group);
    return;
  }

  const stateEl = card.querySelector('.state');
  const body = card.querySelector('.body');
  const out = rec.rawOutput;
  const failed =
    rec.status === 'failed' || (out && typeof out === 'object' && out.exitCode > 0);

  // A name that only turns up once the call is under way, as an MCP call's does.
  if (rec.title) {
    const next = { ...rec, rawInput: rec.rawInput, title: rec.title };
    card.querySelector('.label').textContent = displayLabel(next);
  }

  if (rec.status === 'completed' || rec.status === 'failed' || rec.status === 'cancelled') {
    card.classList.remove('running');
    card.classList.add(failed ? 'failed' : 'done');
    stateEl.textContent = failed ? 'failed' : rec.status === 'cancelled' ? 'stopped' : 'done';
    // Finished and fine: fold it away again, unless it was opened by hand.
    if (!failed && !card.dataset.opened) card.open = false;
  } else if (rec.status) {
    stateEl.textContent = rec.status.replace('_', ' ');
  }

  // Updates repeat the whole content array as it grows, so render only the
  // blocks this card has not seen.
  const blocks = rec.content || [];
  const seen = Number(card.dataset.contentCount || 0);
  if (blocks.length > seen) {
    const stickForContent = nearBottom();
    renderContent(body, blocks.slice(seen), card);
    card.dataset.contentCount = String(blocks.length);
    scrollDown(stickForContent);
  }

  showOutput(card, out, failed);
}

/** Verbose output: the readable text, or the raw JSON when there is none. */
function verboseOutputText(out) {
  const text = toolOutputText(out);
  if (text) return text;
  if (out && typeof out === 'object') return JSON.stringify(out, null, 2);
  return '';
}

/** How many lines of a command's output a folded card shows. */
const PEEK_LINES = 6;

/**
 * Put what a tool printed under its card.
 *
 * Replaced rather than added to: a command reports as it goes, each time with
 * everything it has printed so far, so appending gave the same output three and
 * four times over on a phone.
 *
 * The end of it also stays on the folded card. A card that shuts itself when the
 * command finishes reads as a chat where nothing printed anything — you have to
 * know to tap each one — and the last few lines are the ones that say whether it
 * worked. The whole log is still a tap away.
 */
function showOutput(card, out, failed) {
  const text = state.verbosity === 'verbose' ? verboseOutputText(out) : toolOutputText(out);
  if (!text) return;
  const body = card.querySelector('.body');

  const peek = card.querySelector('summary > .peek');
  if (peek) {
    const lines = text.replace(/\s+$/, '').split('\n');
    peek.textContent = lines.slice(-PEEK_LINES).join('\n');
    peek.hidden = false;
    peek.classList.toggle('more', lines.length > PEEK_LINES);
  }

  const stick = nearBottom();
  let pre = card.querySelector('.body > pre.out');
  if (!pre) {
    body.appendChild(div('cap', 'output'));
    pre = document.createElement('pre');
    pre.className = 'out';
    body.appendChild(pre);
  }
  pre.innerHTML = `<code>${esc(text)}</code>`;
  // What you actually want to read: a command that broke, and one still going.
  if (failed || card.classList.contains('running')) card.open = true;
  scrollDown(stick);
}

/** "No Repo" is Cursor's empty-workspace mark, not a question. */
function isWorkspaceMark(rec) {
  const opts = rec?.options || [];
  return opts.length > 0 && opts.every((opt) => /^no repo$/i.test(String(opt.name || opt.optionId || '').trim()));
}

function renderPermission(rec) {
  if (isWorkspaceMark(rec)) return;
  const card = div('perm');
  const title = rec.toolCall?.title || rec.toolCall?.kind || 'this action';
  card.innerHTML = `
    <div class="head">Permission needed</div>
    <div class="what"></div>
    <div class="opts"></div>`;
  card.querySelector('.what').textContent = title;

  const opts = card.querySelector('.opts');
  for (const opt of rec.options || []) {
    const b = document.createElement('button');
    b.textContent = opt.name || opt.optionId;
    b.className = /reject|deny/i.test(`${opt.kind} ${opt.optionId}`) ? 'deny' : 'allow';
    b.onclick = () => {
      sendOp({ op: 'permission', requestId: rec.requestId, optionId: opt.optionId });
      opts.innerHTML = '<span class="outcome">sending…</span>';
    };
    opts.appendChild(b);
  }
  state.permCards.set(rec.requestId, card);
  add(card);
}

function renderPermissionResolved(rec) {
  const card = state.permCards.get(rec.requestId);
  if (!card) return;
  card.classList.add('resolved');
  const how = rec.cancelled
    ? 'cancelled'
    : `${rec.optionId || 'answered'}${rec.automatic ? ' (policy)' : ''}`;
  card.querySelector('.opts').innerHTML = `<span class="outcome">${esc(how)}</span>`;
}

/**
 * A question the agent is asking, with its real options.
 *
 * Not an approval, and drawn nothing like one: an approval is a short row of
 * buttons, a question is a card of sentences, sometimes several questions deep.
 * A single question with one answer each is a tap; anything more is picked
 * then submitted, because one tap cannot honestly answer two questions.
 */
function renderQuestion(rec) {
  const card = div('ask');
  card.innerHTML = '<div class="head">Question</div>';
  if (rec.title) {
    const t = div('title');
    t.textContent = rec.title;
    card.append(t);
  }

  const questions = rec.questions || [];
  const chosen = {};
  const oneTap = questions.length === 1 && !questions[0]?.multiple;
  const buttons = [];

  const sendAnswer = ({ skip = false } = {}) => {
    sendOp({
      op: 'question.answer',
      sessionId: state.sessionId,
      askId: rec.askId,
      selections: chosen,
      skip,
    });
    for (const b of buttons) b.disabled = true;
    const outcome = card.querySelector('.outcome');
    if (outcome) outcome.textContent = 'sending…';
  };

  for (const q of questions) {
    const block = div('q');
    const prompt = div('prompt');
    prompt.textContent = q.prompt || '';
    block.append(prompt);
    const opts = div('opts');
    for (const opt of q.options || []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = opt.label || opt.id || '';
      b.onclick = () => {
        if (oneTap) {
          chosen[q.id] = [opt.id];
          sendAnswer();
          return;
        }
        const have = new Set(chosen[q.id] || []);
        if (q.multiple) {
          if (have.has(opt.id)) have.delete(opt.id);
          else have.add(opt.id);
        } else {
          have.clear();
          have.add(opt.id);
        }
        chosen[q.id] = [...have];
        for (const other of opts.querySelectorAll('button')) {
          const id = other.dataset.optionId;
          other.classList.toggle('picked', (chosen[q.id] || []).includes(id));
        }
      };
      b.dataset.optionId = opt.id;
      buttons.push(b);
      opts.append(b);
    }
    block.append(opts);
    if (q.multiple) {
      const note = div('cap');
      note.textContent = 'several answers allowed';
      block.append(note);
    }
    card.append(block);
  }

  const actions = div('opts act');
  if (!oneTap) {
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'allow';
    submit.textContent = 'Submit';
    submit.onclick = () => sendAnswer();
    buttons.push(submit);
    actions.append(submit);
  }
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'deny';
  skip.textContent = 'Skip';
  skip.onclick = () => sendAnswer({ skip: true });
  buttons.push(skip);
  actions.append(skip);
  card.append(actions);

  const where = div('cap outcome');
  where.textContent = oneTap ? 'Tap an option to answer.' : 'Pick, then Submit.';
  card.append(where);
  state.askCards.set(rec.askId, card);
  add(card);
}

function renderQuestionAnswered(rec) {
  const card = state.askCards.get(rec.askId);
  if (!card) return;
  card.classList.add('resolved');
  const chosen = Object.values(rec.selections || {}).flat().filter(Boolean);
  const typed = Object.values(rec.texts || {}).filter(Boolean);
  const said = [...chosen, ...typed].join(', ') || rec.state || 'answered';
  card.querySelector('.outcome').textContent = `Answered: ${said}`;
}

function renderCreatedPlan(rec) {
  const card = div('created-plan');
  card.innerHTML = `
    <div class="head">Created Plan</div>
    <div class="title"></div>
    <div class="overview"></div>
    <div class="acts">
      <button type="button" class="view">View Plan</button>
      <span class="build-group">
        <button type="button" class="build">Build</button>
        <select class="build-model" aria-label="Model to build with"></select>
      </span>
    </div>
    <div class="cap outcome"></div>`;
  card.rec = rec;
  card.createdPlan = true;
  fillPlanModels(card.querySelector('.build-model'));

  card.querySelector('.view').onclick = () => openPlanView(card);
  card.querySelector('.build').onclick = () => sendPlanBuild(card);

  if (rec.toolCallId) state.toolCards.set(rec.toolCallId, card);
  paintCreatedPlan(card, rec);
  add(card);
}

/** Full-window plan markdown — same idea as Settings, closed with ×. */
function openPlanView(card) {
  const fields = planFields(card.rec || {});
  state.openPlanId = card.rec?.toolCallId || null;
  state.openPlanCard = card;
  els.planSheetTitle.textContent = fields.name || 'Plan';
  els.planBody.innerHTML = fields.markdown
    ? markdown(fields.markdown)
    : '<p class="sheet-note">No plan text yet.</p>';
  enrichMarkdown(els.planBody);
  els.planBody.scrollTop = 0;
  fillPlanModels(els.planBuildModel);
  const fromCard = card.querySelector('.build-model')?.value;
  if (fromCard != null && [...els.planBuildModel.options].some((o) => o.value === fromCard)) {
    els.planBuildModel.value = fromCard;
  }
  delete els.planBuild.dataset.sent;
  if (card.querySelector('.build')?.dataset.sent) els.planBuild.dataset.sent = '1';
  paintPlanActions(card);
  setPlanSheet(true);
}

function setPlanSheet(open) {
  els.planSheet.hidden = !open;
  if (!open) {
    els.planBody.innerHTML = '';
    els.planSheetTitle.textContent = 'Plan';
    els.planOutcome.textContent = '';
    state.openPlanId = null;
    state.openPlanCard = null;
  }
}

function fillPlanModels(select) {
  select.innerHTML = '';
  const current = document.createElement('option');
  current.value = '';
  current.textContent = 'Current model';
  select.append(current);
  for (const opt of els.model.options) {
    if (!opt.value) continue;
    const copy = document.createElement('option');
    copy.value = opt.value;
    copy.textContent = opt.textContent;
    select.append(copy);
  }
  const mine = state.sessions.find((s) => s.id === state.sessionId);
  if (mine?.model && [...select.options].some((o) => o.value === mine.model)) {
    select.value = mine.model;
  }
}

function sendPlanBuild(card, modelSelect) {
  const rec = card.rec || {};
  const pick = modelSelect || card.querySelector('.build-model');
  const model = pick?.value || '';
  const outcome = card.querySelector('.outcome');
  for (const b of card.querySelectorAll('button, select')) {
    if (!b.classList.contains('view')) b.disabled = true;
  }
  card.querySelector('.build').dataset.sent = '1';
  if (outcome) outcome.textContent = 'building…';
  if (state.openPlanCard === card) {
    els.planBuild.disabled = true;
    els.planBuildModel.disabled = true;
    els.planBuild.dataset.sent = '1';
    els.planOutcome.textContent = 'building…';
  }
  sendOp({
    op: 'plan.build',
    sessionId: state.sessionId,
    toolCallId: rec.toolCallId,
    model,
  });
}

/** Keep the card and the full-window footer in the same Build state. */
function paintPlanActions(card) {
  const fields = planFields(card.rec || {});
  const waiting = fields.awaitingBuild && card.rec.awaitingBuild !== false;
  const sent = Boolean(card.querySelector('.build')?.dataset.sent);
  const outcome = card.querySelector('.outcome');
  card.classList.toggle('resolved', !waiting);
  if (!waiting) {
    if (outcome) outcome.textContent = outcome.textContent?.startsWith('Building')
      ? outcome.textContent
      : 'Built.';
    for (const b of card.querySelectorAll('button, select')) {
      if (!b.classList.contains('view')) b.disabled = true;
    }
  } else if (!sent) {
    if (outcome) outcome.textContent = '';
    for (const b of card.querySelectorAll('button, select')) b.disabled = false;
  }
  if (els.planSheet.hidden || state.openPlanCard !== card) return;
  if (!waiting) {
    els.planOutcome.textContent = els.planOutcome.textContent?.startsWith('Building')
      ? els.planOutcome.textContent
      : 'Built.';
    els.planBuild.disabled = true;
    els.planBuildModel.disabled = true;
  } else if (!sent) {
    els.planOutcome.textContent = '';
    els.planBuild.disabled = false;
    els.planBuildModel.disabled = false;
  } else {
    els.planBuild.disabled = true;
    els.planBuildModel.disabled = true;
    if (!els.planOutcome.textContent) els.planOutcome.textContent = 'building…';
  }
}

function paintCreatedPlan(card, rec) {
  card.rec = { ...(card.rec || {}), ...rec };
  const fields = planFields(card.rec);
  card.querySelector('.title').textContent = fields.name;
  const overview = card.querySelector('.overview');
  overview.textContent = fields.overview;
  overview.hidden = !fields.overview;
  // If this plan is open in the modal, keep the text current as Cursor
  // streams more of it in.
  if (!els.planSheet.hidden && card.rec?.toolCallId && card.rec.toolCallId === state.openPlanId) {
    els.planSheetTitle.textContent = fields.name || 'Plan';
    if (fields.markdown) {
      els.planBody.innerHTML = markdown(fields.markdown);
      enrichMarkdown(els.planBody);
    }
  }
  paintPlanActions(card);
}

function renderPlan(rec) {
  if (isCreatedPlan(rec) || rec.markdown || rec.name) {
    renderCreatedPlan(rec);
    return;
  }
  const card = div('plan', '<div class="head">Plan</div>');
  const ol = document.createElement('ol');
  for (const e of rec.entries || []) {
    const li = document.createElement('li');
    li.className = e.status || '';
    li.textContent = e.content || e.title || '';
    ol.appendChild(li);
  }
  card.appendChild(ol);
  add(card);
}

function renderError(rec) {
  // Stopping puts the prompt back in the box so it can be fixed and sent
  // again — same gesture as Cursor's own Stop. The interrupted turn leaves
  // the stream; the words belong in the composer now.
  if (rec.interrupted && (rec.restore != null || rec.imageParts?.length)) {
    withdrawInterruptedTurn();
    const payload = {
      text: rec.restore || '',
      imageParts: rec.imageParts || [],
    };
    if (state.replaying) state.pendingRestore = payload;
    else fillComposer(payload);
    return;
  }
  const node = div('notice error');
  node.textContent = rec.text || 'error';
  if (rec.retryable && state.lastPrompt) {
    const b = document.createElement('button');
    b.className = 'retry';
    b.textContent = 'Retry';
    b.onclick = () => {
      b.disabled = true;
      submit(state.lastPrompt);
    };
    node.appendChild(b);
  }
  add(node);
}

/**
 * Take the interrupted turn off the stream — user bubble and everything that
 * followed it this turn — so the prompt can live in the composer instead.
 */
function withdrawInterruptedTurn() {
  state.withdrawnTurn = true;
  if (state.streamBody) state.streamBody.style.minHeight = '';
  state.stream = null;
  state.streamKind = null;
  state.streamBody = null;
  state.bundle = null;
  closeThinking();
  dropLiveStatus();
  state.turn = null;
  state.pendingEchoes = [];
  const nodes = [...els.transcript.children];
  let from = -1;
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    if (nodes[i].classList?.contains('msg') && nodes[i].classList.contains('user')) {
      from = i;
      break;
    }
  }
  if (from < 0) return;
  for (let i = from; i < nodes.length; i += 1) nodes[i].remove();
}

/** Put the caret in the message box — new chats and restored drafts both want this. */
function focusComposer() {
  try {
    els.box.focus({ preventScroll: true });
  } catch {
    try {
      els.box.focus();
    } catch {
      /* phone browsers may refuse focus without a tap */
    }
  }
}

/** Put a stopped prompt back in the box, ready to edit and send again. */
function fillComposer({ text = '', imageParts = [] } = {}) {
  els.box.value = text;
  state.attachments = (imageParts || [])
    .map((part) => {
      const mimeType = part.mimeType || part.mime || 'image/png';
      const data = part.data || '';
      const url = part.url || (data ? `data:${mimeType};base64,${data}` : '');
      if (!data && !url) return null;
      return { mimeType, data, url, name: part.name || 'image' };
    })
    .filter(Boolean);
  renderAttachments();
  autosize();
  saveDraft();
  focusComposer();
}

/** After replay, put the latest unreplied interrupt back in the box. */
function applyPendingRestore() {
  const payload = state.pendingRestore;
  state.pendingRestore = null;
  if (payload && (payload.text || payload.imageParts?.length)) fillComposer(payload);
}

function render(rec) {
  if (typeof rec.seq === 'number') state.lastSeq = Math.max(state.lastSeq, rec.seq);
  state.now = rec.ts || Date.now();
  // Prose, approvals and notices do not split the work fold. Cursor keeps
  // every step of the turn in one group; the first sentence sits above it.
  if (
    rec.kind !== 'tool_call' &&
    rec.kind !== 'tool_update' &&
    rec.kind !== 'agent_thought' &&
    rec.kind !== 'agent_delta' &&
    rec.kind !== 'permission_request' &&
    rec.kind !== 'permission_resolved' &&
    rec.kind !== 'notice'
  ) {
    flushBundle();
  }

  switch (rec.kind) {
    case 'user_message':
      // The previous turn's marker may have been trimmed off the replay.
      // Put its file list down before this new message.
      if (state.turn?.fileRecs?.length) {
        publishFiles(state.turn.fileRecs);
        state.turn.fileRecs = [];
      }
      // A later real send means the restored draft from an older interrupt
      // should not land in the box after replay finishes.
      if (state.replaying && !rec.echoed && !rec.waiting) state.pendingRestore = null;
      if (!rec.echoed && !rec.waiting && !takePendingEcho(rec)) renderUser(rec);
      break;
    case 'agent_delta':
    case 'agent_thought':
      renderStreaming(rec);
      break;
    case 'thought_time': {
      const el = rec.desktopBubbleId
        ? els.transcript.querySelector(`details.think[data-bubble="${CSS.escape(rec.desktopBubbleId)}"]`)
        : null;
      if (el && rec.durationMs) {
        el.dataset.duration = String(rec.durationMs);
        const sum = el.querySelector('summary');
        if (sum && !el.open) sum.textContent = thoughtLabel(rec.durationMs);
        else if (sum && el !== state.thinking) sum.textContent = thoughtLabel(rec.durationMs);
      }
      break;
    }
    case 'tool_call':
      renderToolCall(rec);
      break;
    case 'tool_update':
      renderToolUpdate(rec);
      break;
    case 'permission_request':
      renderPermission(rec);
      break;
    case 'permission_resolved':
      renderPermissionResolved(rec);
      break;
    case 'question':
      renderQuestion(rec);
      break;
    case 'question_answered':
      renderQuestionAnswered(rec);
      break;
    case 'plan':
      renderPlan(rec);
      break;
    case 'terminal_chunk':
      writeChunk(rec);
      break;
    case 'error':
      renderError(rec);
      break;
    case 'turn_end':
      endTurn(rec);
      break;
    case 'notice': {
      const el = div('notice');
      el.textContent = rec.text || '';
      add(el);
      break;
    }
    case 'turn_start':
      beginTurn(rec);
      break;
    case 'session_start':
    case 'session_info':
    case 'commands':
      break;
    default:
      break;
  }
  noteLiveRecord(rec);
}

// -------------------------------------------------------------------- rail

/**
 * A div that acts like a button should answer to a keyboard like one. Rows are
 * divs because they hold their own controls, so they borrow the semantics.
 */
function actsAsButton(node, run) {
  node.setAttribute('role', 'button');
  node.tabIndex = 0;
  node.onclick = run;
  node.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    run();
  };
}

/**
 * A control inside a clickable row. The first tap on a phone used to belong
 * to the row — on the open session that just closed the rail, so × looked
 * like it needed a second press to archive.
 */
function insideControl(node, run) {
  let x = 0;
  let y = 0;
  let last = 0;
  node.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    x = e.clientX;
    y = e.clientY;
  });
  node.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  const go = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const pt = e.changedTouches?.[0] || e;
    const cx = pt.clientX ?? x;
    const cy = pt.clientY ?? y;
    if (Math.hypot(cx - x, cy - y) > 16) return;
    const now = Date.now();
    if (now - last < 400) return;
    last = now;
    run();
  };
  node.addEventListener('click', go);
  // iOS can apply :hover on the first tap and skip click; touchend still fires.
  node.addEventListener('touchend', go, { passive: false });
}

function dismissSession(item) {
  if (item.chatId) state.dismissedChats.add(item.chatId);
  state.sessions = state.sessions.filter((s) => s.id !== item.id);
  renderRail();
  sendOp({ op: 'session.archive', sessionId: item.id });
}

const sameFolder = (a, b) =>
  String(a || '').replace(/[\\/]+$/, '').toLowerCase() ===
  String(b || '').replace(/[\\/]+$/, '').toLowerCase();

/**
 * The agent marks in the rail, drawn where the status dot used to be. Cursor's
 * cube and opencode's square are inlined as monochrome paths tinted with the
 * current colour, so they belong to the theme instead of fighting it.
 */
const CURSOR_MARK = `
  <svg viewBox="0 0 500 545" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="m466.383 137.073-206.469-119.2034c-6.63-3.8287-14.811-3.8287-21.441 0l-206.4586 119.2034c-5.5734 3.218-9.0144 9.169-9.0144 15.615v240.375c0 6.436 3.441 12.397 9.0144 15.615l206.4686 119.203c6.63 3.829 14.811 3.829 21.441 0l206.468-119.203c5.574-3.218 9.015-9.17 9.015-15.615v-240.375c0-6.436-3.441-12.397-9.015-15.615zm-12.969 25.25-199.316 345.223c-1.347 2.326-4.904 1.376-4.904-1.319v-226.048c0-4.517-2.414-8.695-6.33-10.963l-195.7577-113.019c-2.3263-1.347-1.3764-4.905 1.3182-4.905h398.6305c5.661 0 9.199 6.136 6.368 11.041h-.009z"/>
  </svg>`;

const OPENCODE_MARK = `
  <svg viewBox="0 0 16 20" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 16H4V8H12V16Z" fill="currentColor" opacity="0.45"/>
    <path d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="currentColor" fill-rule="evenodd"/>
  </svg>`;

/**
 * The mark of whichever agent drives a row, where the status dot used to sit.
 * It keeps the dot's job too: the colour says how the session is doing, so a
 * busy opencode session still reads as busy and not merely as branded.
 */
function agentMark(item) {
  const agent = item.agent === 'opencode' ? 'opencode' : 'cursor';
  const status = item.session ? item.status || 'idle' : 'resting';
  const mark = div(`agent-mark agent-${agent} ${status}`);
  mark.innerHTML = agent === 'opencode' ? OPENCODE_MARK : CURSOR_MARK;
  mark.title = `${agent} · ${item.session ? status : 'not open here'}`;
  return mark;
}

/**
 * One row in the rail — either a session Auto is running, or a chat sitting
 * in Cursor that you have not opened here yet. They look alike on purpose:
 * tapping either one puts you in that conversation. The repo is not repeated
 * here: rows live inside the repo's accordion, so the title is enough.
 */
function relTime(at) {
  const ms = typeof at === 'number' && at > 1e11 ? at : Date.parse(at || '') || 0;
  if (!ms) return '';
  const min = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

function sessionRow(item) {
  const row = div('session' + (item.id && item.id === state.sessionId ? ' active' : ''));
  const dot = document.createElement('span');
  dot.className = 'rail-dot';
  const meta = div('meta');

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = item.title || 'session';
  meta.append(name);

  const env = document.createElement('span');
  env.className = 'rail-env';
  env.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6-1.5A3.5 3.5 0 0 0 7 18z"/></svg>';
  const age = document.createElement('span');
  age.className = 'age';
  age.textContent = relTime(item.at);

  row.append(dot, meta, env, age);

  // Only Auto's own list can be tidied; a chat belongs to the IDE.
  if (item.session) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.textContent = '×';
    close.title = 'Archive session';
    insideControl(close, () => dismissSession(item));
    row.append(close);
  }

  row.title = item.session
    ? item.title
    : `${item.title} — open it here; the same chat as in Cursor`;
  actsAsButton(row, () => {
    if (item.session) return attach(item.id);
    row.classList.add('busy');
    sendOp({ op: 'desktop.continue', chatId: item.chatId, folder: item.folder });
    return undefined;
  });
  return row;
}

/**
 * Everything you might want to carry on with, newest first: Auto's sessions
 * and Cursor's chats in one list, since from here they are the same kind of
 * thing. A chat already open in Auto appears once, as the session.
 */
function conversations() {
  const rows = state.sessions.map((s) => ({
    session: true,
    id: s.id,
    chatId: s.desktopThreadId || null,
    title: s.title || 'session',
    status: s.status,
    folder: s.folder,
    project: (s.folder || '').split(/[\\/]/).filter(Boolean).pop() || '',
    // Which agent drives it — the row is marked with that agent's logo, so an
    // Auto-only opencode session is told apart from a Cursor chat.
    agent: s.agent || 'cursor',
    at: Date.parse(s.updatedAt || s.createdAt || '') || 0,
  }));

  const open = new Set(rows.map((r) => r.chatId).filter(Boolean));
  for (const c of state.chats) {
    if (open.has(c.id) || state.dismissedChats.has(c.id)) continue;
    rows.push({
      session: false,
      id: null,
      chatId: c.id,
      title: c.title,
      folder: c.folder,
      project: c.project,
      at: c.updatedAt || c.createdAt || 0,
    });
  }

  return rows.sort((a, b) => b.at - a.at);
}

/**
 * Whether a repo's conversations are shown. The rail remembers which
 * accordions you opened, keyed by folder; one with no memory yet opens when it
 * holds the chat you are in, and stays shut otherwise. There is no
 * Chats/Projects split any more: one list of repos, each holding its own.
 */
const RAIL_REPOS_KEY = 'auto.railRepos';

function railOpenRepos() {
  try {
    const raw = localStorage.getItem(RAIL_REPOS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : null;
  } catch {
    return null;
  }
}

function rememberRailRepos(set) {
  try {
    localStorage.setItem(RAIL_REPOS_KEY, JSON.stringify([...set]));
  } catch {
    /* private mode */
  }
}

const folderKey = (path) => String(path || '').replace(/[\\/]+$/, '').toLowerCase();
const folderName = (path) => String(path || '').split(/[\\/]/).filter(Boolean).pop() || '';

/** Keep the repo holding a session open, so attaching never hides it away. */
function openRepoFor(folder) {
  if (!folder) return;
  const set = railOpenRepos() || new Set();
  set.add(folderKey(folder));
  rememberRailRepos(set);
}

/**
 * Everything you might carry on with, grouped by the folder it lives in. Chats
 * and sessions are one list; a repo with no conversations still appears,
 * because that is where its + starts something new.
 */
function railRepos() {
  const byKey = new Map();
  const add = (folder, name, inCursor = false, desktopChats = 0) => {
    const key = folderKey(folder);
    if (!key) return null;
    let repo = byKey.get(key);
    if (!repo) {
      repo = {
        folder,
        name: name || folderName(folder) || folder,
        inCursor,
        desktopChats,
        at: 0,
        items: [],
      };
      byKey.set(key, repo);
    } else {
      if (inCursor) repo.inCursor = true;
      if (desktopChats) repo.desktopChats = Math.max(repo.desktopChats, desktopChats);
    }
    return repo;
  };

  for (const p of state.projects) add(p.path, p.name, p.open, p.desktopChats || 0);
  for (const s of state.sessions) add(s.folder, folderName(s.folder));

  for (const item of conversations()) {
    const repo = add(item.folder, item.project);
    if (!repo) continue;
    repo.items.push(item);
    repo.at = Math.max(repo.at, item.at || 0);
  }

  // Folders with conversations lead, newest first; the rest keep a stable
  // order, with whatever Cursor has open brought to the top of that group.
  return [...byKey.values()].sort((a, b) => {
    const aHas = a.items.length > 0;
    const bHas = b.items.length > 0;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && b.at !== a.at) return b.at - a.at;
    if (a.inCursor !== b.inCursor) return a.inCursor ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}

/** One repo: its name and + in the summary, its conversations inside. */
function repoSection(repo, stored, activeKey) {
  const key = folderKey(repo.folder);
  const details = document.createElement('details');
  details.className = 'repo';
  details.dataset.folder = repo.folder;
  details.open = stored
    ? stored.has(key)
    : repo.collapsed != null
      ? !repo.collapsed
      : Boolean(activeKey && key === activeKey);

  const summary = document.createElement('summary');
  summary.className = 'repo-head';

  // A disclosure caret says "tap to expand": it points right when shut and
  // turns down when open.
  const caret = document.createElement('span');
  caret.className = 'repo-caret';
  caret.setAttribute('aria-hidden', 'true');
  caret.innerHTML =
    repo.kind === 'home'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2h7.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>';
  summary.append(caret);

  const name = document.createElement('span');
  name.className = 'repo-name';
  name.textContent = repo.name;
  name.title = repo.folder;
  summary.append(name);

  if (repo.inCursor) {
    const open = document.createElement('span');
    open.className = 'repo-open';
    open.textContent = 'open';
    open.title = 'Open in Cursor';
    summary.append(open);
  }

  const count = document.createElement('span');
  count.className = 'repo-count';
  count.textContent = repo.items.length ? String(repo.items.length) : '';
  summary.append(count);

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'repo-add';
  add.textContent = '+';
  add.title = `New session in ${repo.name || 'this folder'}`;
  add.setAttribute('aria-label', add.title);
  // insideControl stops the summary from toggling, and handles the hover-then-
  // tap a phone gives a control that lives inside a clickable row.
  insideControl(add, () => createSession(repo.folder));
  summary.append(add);

  const body = div('repo-body');
  const preview = 5;
  if (!repo.items.length) {
    body.append(said('rail-empty', 'No chats yet.'));
  } else {
    repo.items.forEach((item, i) => {
      const row = sessionRow(item);
      if (i >= preview) row.hidden = true;
      body.append(row);
    });
    if (repo.items.length > preview) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'rail-more';
      more.textContent = 'More';
      more.onclick = () => {
        body.querySelectorAll('.session').forEach((row) => {
          row.hidden = false;
        });
        more.remove();
      };
      body.append(more);
    }
  }
  if (!repo.fromSidebar) {
    const desktop = desktopChatsBlock(repo);
    if (desktop) body.append(desktop);
  }

  details.append(summary, body);
  details.addEventListener('toggle', () => {
    // Clearing the rail fires toggle as these leave the tree; not a collapse.
    if (!details.isConnected) return;
    const set = railOpenRepos() || new Set();
    if (details.open) set.add(key);
    else set.delete(key);
    rememberRailRepos(set);
  });
  return details;
}

/**
 * The rail is the folders you work in, newest activity first, each one an
 * accordion holding the chats and sessions inside it. Repos replace the old
 * Chats/Projects rows and their date headings: a conversation always lives
 * somewhere, so grouping by where beats grouping by when.
 */
function pinColor(name) {
  const known = {
    green: '#3dd68c',
    blue: '#6ea8fe',
    orange: '#e6a15c',
    purple: '#c084fc',
    red: '#f07178',
    yellow: '#e6c15c',
  };
  if (known[name]) return known[name];
  let n = 0;
  for (const ch of String(name || '')) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${n % 360} 62% 58%)`;
}

function sessionItem(s) {
  return {
    session: true,
    id: s.id,
    chatId: s.desktopThreadId || null,
    title: s.title || folderName(s.folder) || 'session',
    folder: s.folder,
    project: folderName(s.folder),
    agent: s.agent || 'cursor',
    at: Date.parse(s.updatedAt || s.createdAt || '') || 0,
  };
}

function reposFromSidebar(sidebar) {
  const byThread = new Map(
    state.sessions.filter((s) => s.desktopThreadId).map((s) => [s.desktopThreadId, s]),
  );
  const repos = (sidebar.repos || []).map((repo) => ({
    folder: repo.folder || '',
    name: repo.name,
    kind: repo.kind,
    collapsed: repo.collapsed,
    fromSidebar: true,
    inCursor: false,
    items: (repo.chats || []).map((chat) => {
      const known = byThread.get(chat.id);
      if (known) return sessionItem(known);
      return {
        session: false,
        id: null,
        chatId: chat.id,
        title: chat.title,
        folder: chat.folder || repo.folder,
        at: chat.at || 0,
      };
    }),
  }));
  const seen = new Set(repos.flatMap((repo) => repo.items.map((item) => item.id).filter(Boolean)));
  for (const s of state.sessions) {
    if (seen.has(s.id)) continue;
    const key = folderKey(s.folder);
    let repo = repos.find((row) => folderKey(row.folder) === key);
    if (!repo) {
      repo = {
        folder: s.folder || '',
        name: folderName(s.folder) || 'No Repo',
        kind: s.folder ? 'folder' : 'home',
        collapsed: false,
        fromSidebar: true,
        inCursor: false,
        items: [],
      };
      repos.push(repo);
    }
    repo.items.push(sessionItem(s));
    repo.items.sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  return repos;
}

function paintPinned() {
  const wrap = div('rail-projects');
  const head = div('rail-section');
  const label = document.createElement('span');
  label.textContent = 'Projects';
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'rail-section-add';
  plus.textContent = '+';
  plus.title = 'New Project';
  plus.setAttribute('aria-label', 'New Project');
  plus.onclick = () => $('new-session').click();
  head.append(label, plus);
  wrap.append(head);

  const fresh = div('rail-link');
  fresh.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/></svg>';
  const freshName = document.createElement('span');
  freshName.textContent = 'New Project';
  fresh.append(freshName);
  fresh.onclick = () => $('new-session').click();
  wrap.append(fresh);

  const sub = div('rail-sub');
  sub.textContent = 'Pinned';
  wrap.append(sub);

  const pinned = state.sidebar?.pinned || [];
  const preview = 5;
  pinned.forEach((project, i) => {
    const row = div('session pin');
    if (i >= preview) row.hidden = true;
    const dot = document.createElement('span');
    dot.className = 'rail-dot pin';
    dot.style.color = pinColor(project.color || project.name);
    const meta = div('meta');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = project.name;
    meta.append(name);
    const age = document.createElement('span');
    age.className = 'age';
    age.textContent = relTime(project.at);
    if (project.cloud) {
      const env = document.createElement('span');
      env.className = 'rail-env';
      env.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6-1.5A3.5 3.5 0 0 0 7 18z"/></svg>';
      row.append(dot, meta, env, age);
    } else row.append(dot, meta, age);
    actsAsButton(row, () => {
      const known = state.sessions.find((s) => s.desktopThreadId === project.id);
      if (known) return attach(known.id);
      if (project.id && project.folder) {
        sendOp({ op: 'desktop.continue', chatId: project.id, folder: project.folder });
        return undefined;
      }
      if (project.folder) createSession(project.folder);
      else $('new-session').click();
      return undefined;
    });
    wrap.append(row);
  });
  if (pinned.length > preview) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'rail-more';
    more.textContent = 'More';
    more.onclick = () => {
      wrap.querySelectorAll('.session.pin').forEach((row) => {
        row.hidden = false;
      });
      more.remove();
    };
    wrap.append(more);
  }

  const reposHead = div('rail-section');
  const reposLabel = document.createElement('span');
  reposLabel.textContent = 'Repositories';
  reposHead.append(reposLabel);
  wrap.append(reposHead);
  els.rail.append(wrap);
}

function renderRail() {
  els.rail.innerHTML = '';
  paintPinned();
  const repos = state.sidebar?.repos?.length ? reposFromSidebar(state.sidebar) : railRepos();
  if (!repos.length && !(state.sidebar?.pinned || []).length) {
    els.rail.append(said('rail-empty', 'No projects yet — start a new session.'));
    return;
  }
  const stored = railOpenRepos();
  const mine = state.sessions.find((s) => s.id === state.sessionId);
  const activeKey = folderKey(mine?.folder);
  for (const repo of repos) els.rail.append(repoSection(repo, stored, activeKey));
  applyRailFilter();
}

/**
 * Chats you had in the desktop app. They are not Auto's, so they only load
 * when you ask for them; opening one gives you a session pointing at the
 * IDE's own thread, which both ends then share.
 */
function desktopChatsBlock(repo) {
  if (!repo.desktopChats || !repo.folder) return null;

  const box = document.createElement('details');
  box.className = 'desktop-chats';
  const summary = document.createElement('summary');
  summary.textContent = `${repo.desktopChats} desktop ${repo.desktopChats === 1 ? 'chat' : 'chats'}`;
  box.append(summary);

  const body = div('desktop-chat-list');
  body.textContent = 'Loading…';
  box.append(body);

  box.ontoggle = () => {
    if (!box.open) return;
    state.chatTarget = repo.folder;
    sendOp({ op: 'desktop.chats', folder: repo.folder });
  };
  box.dataset.folder = repo.folder;
  return box;
}

function renderDesktopChats(folder, chats) {
  const box = [...document.querySelectorAll('.desktop-chats')].find(
    (el) => sameFolder(el.dataset.folder, folder),
  );
  if (!box) return;
  const body = box.querySelector('.desktop-chat-list');
  body.innerHTML = '';

  // Recent chats are already rows in this repo; this list is for the older
  // ones that did not fit, so do not draw the same conversation twice.
  const shown = new Set(conversations().map((r) => r.chatId).filter(Boolean));
  const rest = chats.filter((c) => !shown.has(c.id));

  if (!rest.length) {
    body.textContent = chats.length
      ? 'No more chats for this folder.'
      : 'No chats found for this folder.';
    return;
  }

  for (const c of rest) {
    const row = div('desktop-chat');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = c.title;
    const sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = c.attached
      ? 'open here'
      : [c.subtitle, c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : '']
          .filter(Boolean)
          .join(' · ');
    row.append(name, sub);
    row.title = 'Open this chat — the same conversation as in Cursor';
    actsAsButton(row, () => {
      row.classList.add('busy');
      sub.textContent = 'Opening…';
      sendOp({ op: 'desktop.continue', chatId: c.id, folder });
    });
    body.append(row);
  }
}

/**
 * What to call a model on screen.
 *
 * Agents namespace a model by provider — "Vercel AI Gateway/DeepSeek V4.1
 * Flash" — and that prefix is the same on every row while the part that tells
 * them apart is the last segment. Show the name alone; the id keeps the rest.
 * Older catalogs cached in a tab may still carry the prefix, so clean here too.
 */
function modelDisplayName(name) {
  const text = String(name || '').replace(/\[.*$/, '').trim();
  return text.split(/[\\/]/).pop().trim() || text;
}

/**
 * What the model <select> should say for a catalog row.
 *
 * The agent names models as slugs (`kimi-k3`) while Cursor's menu uses words
 * (`Kimi K3`). Hyphens become spaces so the chip matches what the IDE shows.
 */
function modelOptionLabel(m) {
  if (m.modelId === 'default[]') return 'Auto-select (Cursor picks)';
  const name = modelDisplayName(m.name || m.modelId || '');
  if (/\s/.test(name) || !name.includes('-')) return name;
  return name
    .split('-')
    .map((part) => (part && /[a-z]/.test(part[0]) ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

/**
 * The model list comes from the agent, not from us — 33 entries whose ids
 * carry their options. Keep the id as the value and show the friendly name.
 */
function renderModels(models) {
  const named = (models || []).filter((model) => model.modelId !== 'default[]');
  const signature = named.map((model) => model.modelId).join(',');
  if (!named.length || els.model.dataset.filled === signature) return;
  const was = els.model.value;
  els.model.innerHTML = '';
  for (const m of named) {
    const opt = document.createElement('option');
    opt.value = m.modelId;
    opt.textContent = modelOptionLabel(m);
    els.model.append(opt);
  }
  if (named.some((model) => model.modelId === was)) els.model.value = was;
  els.model.dataset.filled = signature;
  renderModelList();
  updateModelPresentation();
}

/**
 * Point the model <select> at a session's choice.
 *
 * Options are keyed by model id. After a desktop switch Auto used to store
 * Cursor's label instead, which matched no option and left the control blank
 * even though a model was selected. Fall back to the friendly name (and to a
 * label Cursor's menu would show) so an already-wrong stored value still paints.
 */
function rememberParameter(id, value) {
  const parameter = state.modelControls?.parameters?.find((item) => item.id === id);
  if (parameter) parameter.value = value;
  updateModelPresentation();
}

function paintBuiltinParameters(modelId) {
  const next = controlsFor(modelId);
  const current = state.modelControls;
  const same =
    current?.status === 'ok' &&
    Boolean(current.auto) === Boolean(next.auto) &&
    current.model === next.model &&
    current.parameters?.length;
  if (same) {
    next.parameters = next.parameters.map((parameter) => {
      const kept = current.parameters.find((item) => item.id === parameter.id);
      return kept ? { ...parameter, value: kept.value } : parameter;
    });
  }
  renderModelControls(next);
}

function selectModel(modelId, modelName) {
  paintBuiltinParameters(modelId);
  if (!els.model.options.length) return;
  const automatic = modelId === 'default[]';
  els.modelAuto.checked = automatic;
  if (automatic) return;
  const options = [...els.model.options];
  if (modelId && options.some((o) => o.value === modelId)) {
    els.model.value = modelId;
    renderModelList();
    updateModelPresentation();
    return;
  }
  const name = modelDisplayName(modelName || modelId || '');
  if (!name) return;
  const byName = options.find((o) => o.textContent === name);
  if (byName) {
    els.model.value = byName.value;
    renderModelList();
    updateModelPresentation();
    return;
  }
  const byPrefix = options
    .filter((o) => o.textContent && name.toLowerCase().startsWith(o.textContent.toLowerCase()))
    .sort((a, b) => b.textContent.length - a.textContent.length)[0];
  if (byPrefix) els.model.value = byPrefix.value;
  renderModelList();
  paintBuiltinParameters(els.model.value);
}

function selectedModelLabel() {
  return els.model.selectedOptions[0]?.textContent || state.modelControls?.model || 'Choose a model';
}

/** One compact composer button; details belong in the sheet. */
function updateModelPresentation() {
  if (!state.modelUpdating && state.modelControls) {
    els.modelAuto.checked = Boolean(state.modelControls.auto);
  }
  const automatic = els.modelAuto.checked;
  els.modelOpen.hidden = automatic;

  if (automatic) {
    return;
  }

  const model = modelDisplayName(state.modelControls?.model || selectedModelLabel());
  els.modelChoiceLabel.textContent = model;
  els.modelChoice.disabled = Boolean(state.modelUpdating);

  const parameters = state.modelControls?.parameters || [];
  const thinking = parameters.find((parameter) => /^(reasoning|effort|reasoning_effort)$/i.test(parameter.id));
  const fast = parameters.find((parameter) => parameter.id === 'fast' && parameter.value);
  const parts = [model, thinking?.value, fast ? 'Fast' : null].filter(Boolean);
  els.modelSummary.textContent = parts.join(' · ') || 'Model';
}

/**
 * Tell the rail how tall the page on it is.
 *
 * Both pages are absolutely positioned so neither props the dialog open at
 * the other's height, which leaves the rail with no height of its own. Easing
 * it to the measured one is what makes the dialog grow into the list rather
 * than snap; `animate: false` is for the frame the sheet opens on, where
 * there is nothing to grow from.
 */
function sizeModelRail({ animate = true } = {}) {
  if (!els.modelPages || els.modelSheet.hidden) return;
  const onList = els.modelPanel.dataset.page === 'list';
  const inner = (onList ? els.modelListPane : els.modelSettingsPage).firstElementChild;
  const height = Math.ceil(inner.getBoundingClientRect().height);
  if (!height) return;
  if (animate) {
    els.modelPages.style.height = `${height}px`;
    return;
  }
  els.modelPages.classList.add('model-pages-still');
  els.modelPages.style.height = `${height}px`;
  void els.modelPages.offsetHeight;
  els.modelPages.classList.remove('model-pages-still');
}

/** Move between the sheet's two pages: settings, and the list of models. */
function setModelPage(page) {
  const onList = page === 'list' && !els.modelChoice.disabled;
  els.modelPanel.dataset.page = onList ? 'list' : 'settings';
  els.modelChoice.setAttribute('aria-expanded', String(onList));
  els.modelBack.hidden = !onList;
  els.modelSheetTitle.textContent = onList ? 'Choose model' : 'Model';
  els.modelListPane.inert = !onList;
  els.modelSettingsPage.inert = onList;
  if (onList) {
    els.modelFilter.value = '';
    renderModelList();
    // A phone raising its keyboard over the list it has just opened is worse
    // than arriving without a caret, so only a mouse gets the search focused.
    if (window.matchMedia('(hover: hover)').matches) {
      setTimeout(() => els.modelFilter.focus(), 0);
    }
  }
  sizeModelRail();
}

function renderModelList() {
  if (!els.modelList) return;
  const query = String(els.modelFilter?.value || '').trim().toLowerCase();
  els.modelList.innerHTML = '';
  for (const option of els.model.options) {
    if (query && !option.textContent.toLowerCase().includes(query)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'model-list-option';
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(option.value === els.model.value));
    const price = modelPrice(option.value);
    if (price) button.setAttribute('aria-label', `${option.textContent}, ${price.ariaLabel}`);
    const priceBadge = price
      ? `<span class="model-price" aria-hidden="true" title="${esc(price.title)}">${price.symbols}</span>`
      : '';
    button.innerHTML = `
      <span class="model-list-name">${esc(option.textContent)}</span>
      <span class="model-list-meta">
        ${priceBadge}
        <span class="model-list-check" aria-hidden="true">${option.value === els.model.value ? '✓' : ''}</span>
      </span>
    `;
    button.onclick = () => {
      els.model.value = option.value;
      setModelPage('settings');
      els.model.onchange();
    };
    els.modelList.append(button);
  }
  if (!els.modelList.children.length) {
    const empty = document.createElement('div');
    empty.className = 'sheet-note model-list-empty';
    empty.textContent = 'No matching models';
    els.modelList.append(empty);
  }
  if (els.modelPanel?.dataset.page === 'list') sizeModelRail();
}

function setModelUpdating(updating, text = 'Updating Cursor…') {
  state.modelUpdating = Boolean(updating);
  els.modelStatus.textContent = updating ? text : '';
  els.modelAuto.disabled = Boolean(updating);
  els.modelChoice.disabled = Boolean(updating);
  for (const control of els.modelParameters.querySelectorAll('input, select')) {
    control.disabled = Boolean(updating);
  }
  els.modelOpen.classList.toggle('loading', Boolean(updating));
  updateModelPresentation();
}

/**
 * Open and close are the same motion played both ways.
 *
 * The panel and the veil behind it are their own layers so a finger can ask
 * either to move: the chat softens as the sheet arrives and sharpens as it
 * leaves, and while the sheet is being dragged down the veil is set from the
 * finger — the chat is already sharp by the time the sheet would have gone.
 * `out` is the resting pose, applied while the sheet is hidden so opening
 * starts from the bottom rather than from wherever it was last seen.
 */
function setModelSheet(open) {
  if (!open) {
    if (els.modelSheet.hidden) return;
    // Leave by the same edge it arrived from: the panel falls, the veil
    // sharpens, and only then is the sheet taken out of the page.
    els.modelSheet.dataset.panel = 'out';
    els.modelSheet.dataset.veil = 'out';
    setModelPage('settings');
    clearTimeout(state.modelSheetTimer);
    state.modelSheetTimer = setTimeout(() => {
      els.modelSheet.hidden = true;
    }, 320);
    return;
  }
  clearTimeout(state.modelSheetTimer);
  syncTopbarHeight();
  els.modelSheet.hidden = false;
  setModelPage('settings');
  sizeModelRail({ animate: false });
  els.modelSheet.dataset.panel = 'out';
  els.modelSheet.dataset.veil = 'out';
  void els.modelSheet.offsetHeight;
  els.modelSheet.dataset.panel = 'in';
  els.modelSheet.dataset.veil = 'in';
  setModelUpdating(false);
}

/** Paint the same controls Cursor puts in its model settings sheet. */
function renderModelControls(controls) {
  state.modelControls = controls?.status === 'ok' ? controls : null;
  const automatic = Boolean(state.modelControls?.auto);
  els.modelAuto.checked = automatic;
  els.modelParameters.innerHTML = '';
  els.modelParametersGroup.hidden = true;
  setModelPage('settings');
  updateModelPresentation();
  const parameters = state.modelControls?.parameters || [];
  if (!state.modelControls || (automatic && !parameters.length)) {
    setModelUpdating(false);
    sizeModelRail();
    return;
  }

  for (const parameter of parameters) {
    const row = document.createElement('div');
    row.className = 'model-config-row';
    const copy = document.createElement('span');
    copy.className = 'model-config-copy';
    const name = document.createElement('strong');
    name.textContent = parameter.label;
    copy.append(name);

    if (parameter.type === 'toggle') {
      const value = document.createElement('small');
      value.textContent = parameter.value ? 'On' : 'Off';
      copy.append(value);
      const label = document.createElement('label');
      label.className = 'model-switch';
      label.title = parameter.label;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.role = 'switch';
      input.checked = Boolean(parameter.value);
      input.setAttribute('aria-label', parameter.label);
      const track = document.createElement('span');
      track.className = 'model-switch-track';
      track.setAttribute('aria-hidden', 'true');
      input.onchange = () => {
        rememberParameter(parameter.id, input.checked);
        sendOp({
          op: 'session.modelParameter',
          sessionId: state.sessionId,
          parameter: parameter.id,
          value: input.checked,
        });
      };
      label.append(input, track);
      row.append(copy, label);
      els.modelParameters.append(row);
      continue;
    }

    const select = document.createElement('select');
    select.title = parameter.label;
    select.setAttribute('aria-label', parameter.label);
    select.dataset.parameter = parameter.id;
    for (const value of parameter.options || [parameter.value]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.append(option);
    }
    select.value = parameter.value;
    select.onchange = () => {
      rememberParameter(parameter.id, select.value);
      sendOp({
        op: 'session.modelParameter',
        sessionId: state.sessionId,
        parameter: parameter.id,
        value: select.value,
      });
    };
    // The app draws its own chevron: a native one is the OS speaking, not us.
    const field = document.createElement('span');
    field.className = 'model-select';
    const chevron = document.createElement('span');
    chevron.className = 'model-select-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    field.append(select, chevron);
    row.append(copy, field);
    els.modelParameters.append(row);
  }
  els.modelParametersGroup.hidden = !els.modelParameters.children.length;
  setModelUpdating(false);
  updateModelPresentation();
  sizeModelRail();
}

/**
 * Cursor's current modes, in the order the IDE lists them. The catalog from
 * an ACP session may only name three of these; Debug and Multitask still
 * belong in the picker, because a desktop chat has them.
 */
const CURSOR_MODES = [
  { id: 'agent', name: 'Agent' },
  { id: 'plan', name: 'Plan' },
  { id: 'debug', name: 'Debug' },
  { id: 'multitask', name: 'Multitask' },
  { id: 'ask', name: 'Ask' },
];

function canonicalModeId(raw) {
  const id = String(raw || 'agent').toLowerCase();
  return id === 'chat' ? 'ask' : id;
}

function mergeModes(modes) {
  const byId = new Map(CURSOR_MODES.map((m) => [m.id, { ...m }]));
  for (const m of modes || []) {
    const id = canonicalModeId(m.id || m);
    if (!id) continue;
    byId.set(id, { id, name: m.name || byId.get(id)?.name || id });
  }
  const known = CURSOR_MODES.map((m) => byId.get(m.id)).filter(Boolean);
  const extra = [...byId.values()].filter((m) => !CURSOR_MODES.some((k) => k.id === m.id));
  return [...known, ...extra];
}

/**
 * The ring, the send button, and the mode word all take the hue for the
 * mode in force — Agent blue, Plan amber, Ask green, Debug red, Multitask
 * purple — the same map Cursor uses on its own chat box.
 */
function paintMode(mode = els.mode.value) {
  if (!els.composerBox) return;
  const id = canonicalModeId(mode);
  els.composerBox.dataset.mode = id;
  // The model sheet is the chat box opened out, so it carries the same edge.
  if (els.modelPanel) els.modelPanel.dataset.mode = id;
}

/**
 * Modes travel with the same catalog. The five in the markup are the ones
 * Cursor currently offers; whatever else the agent names is appended.
 */
function renderModes(modes) {
  const list = mergeModes(modes);
  const ids = list.map((m) => m.id).join(',');
  if (els.mode.dataset.filled === ids) return;
  const was = els.mode.value;
  els.mode.innerHTML = '';
  for (const m of list) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name || m.id;
    els.mode.append(opt);
  }
  // Keep the session's choice selected if the new list still contains it.
  if ([...els.mode.options].some((o) => o.value === was)) els.mode.value = was;
  els.mode.dataset.filled = ids;
  paintMode();
}

function applyMeta(meta) {
  if (!meta) return;
  els.title.textContent = meta.title || 'session';
  els.folder.textContent = meta.folder || '';
  els.mode.value = canonicalModeId(meta.mode);
  els.policy.value = meta.policy || 'ask';
  paintMode(meta.mode);
  // A session that has never run has no model yet; leave the picker as-is.
  if (meta.model) selectModel(meta.model, meta.modelName);
  setBusy(meta.status === 'busy');
  const label = meta.status === 'busy' ? 'working' : meta.status || 'idle';
  const kind = meta.status === 'busy' ? 'busy' : meta.status === 'error' ? 'error' : 'idle';
  els.status.className = `dot ${kind}`;
  els.status.title = label;
  els.status.setAttribute('aria-label', label);
  paintNewChat();
}

/** Folder of the open chat — what a same-repo "New chat" should start in. */
function currentFolder() {
  const mine = state.sessions.find((s) => s.id === state.sessionId);
  return String(mine?.folder || els.folder.textContent || '').trim();
}

/**
 * Topbar New chat is only live when this tab is on a session that has a
 * folder. No folder means nowhere to start the next empty conversation.
 */
function paintNewChat() {
  const btn = $('new-chat');
  if (!btn) return;
  const folder = currentFolder();
  btn.disabled = !folder;
  const name = folder ? folder.split(/[/\\]/).filter(Boolean).pop() : '';
  btn.title = folder
    ? `New chat in ${name || 'this repo'}`
    : 'Open a session to start a new chat';
  btn.setAttribute('aria-label', btn.title);
}

/**
 * Both buttons while a turn runs: stop it, or add to it.
 *
 * Sending used to be impossible until the agent was free, which meant holding a
 * thought until you noticed the turn had ended. Anything sent now joins a queue
 * and goes in when the turn finishes, so the button stays live and says which of
 * the two it is doing.
 */
function setBusy(busy) {
  const was = state.busy;
  state.busy = busy;
  els.stop.hidden = !busy;
  els.send.title = busy ? 'Add to the queue' : 'Send';
  els.send.setAttribute('aria-label', els.send.title);
  els.send.classList.toggle('queueing', busy);
  els.box.placeholder = busy ? 'Add to the queue…' : 'Message the agent…';
  syncSend();
  if (state.replaying) return;
  if (busy && !was) paintLiveStatus();
  if (!busy && was) {
    settleRunningTools();
    dropLiveStatus();
  }
}

/** Send is only live when there is something to send. */
function syncSend() {
  els.send.disabled = !(els.box.value.trim() || state.attachments.length);
}

// ------------------------------------------------------------------ socket

function sendOp(msg) {
  if (state.ws?.readyState === 1) state.ws.send(JSON.stringify(msg));
}

/**
 * Which chat this tab was looking at. The host's active session is shared with
 * Telegram, so it is a poor stand-in: a /switch there, or another tab, would
 * steal this one on reload. The URL is this tab's; localStorage is for opening
 * Auto at `/` (the PWA start URL) and still landing in the same conversation.
 */
const SESSION_KEY = 'auto.session';
const VIEWS_KEY = 'auto.views';

function rememberedSession() {
  try {
    const fromUrl = new URLSearchParams(location.search).get('session');
    if (fromUrl) return fromUrl;
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function rememberSession(id) {
  if (!id) return;
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* private mode: the choice lasts as long as the page does */
  }
  const url = new URL(location.href);
  if (url.searchParams.get('session') === id) return;
  url.searchParams.set('session', id);
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

/** Which tool tabs were open for a chat — survives refresh and session switch. */
function rememberedViews(sessionId) {
  if (!sessionId) return null;
  try {
    const all = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}');
    return all[sessionId] || null;
  } catch {
    return null;
  }
}

function rememberViews(sessionId, snap) {
  if (!sessionId || !snap) return;
  try {
    const all = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}');
    all[sessionId] = snap;
    const keys = Object.keys(all);
    // Cap growth: drop the oldest-looking keys beyond a few dozen chats.
    if (keys.length > 40) {
      for (const k of keys.slice(0, keys.length - 40)) delete all[k];
    }
    localStorage.setItem(VIEWS_KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

function attach(sessionId) {
  if (sessionId === state.sessionId) {
    setRail(false);
    return;
  }
  // Keep the chat we are leaving so switching back is instant.
  if (state.sessionId && (state.liveRecords.length || state.liveHead.length)) {
    const snap = saveCache(state.sessionId, state.liveRecords, state.liveEarlier, state.liveHead);
    if (snap) {
      scheduleDiskSave(state.sessionId, snap);
      flushDiskSave(state.sessionId);
    }
  }
  saveDraft(state.sessionId);
  setPlanSheet(false);
  // Reveal the repo this chat lives in, so it is never hidden by a shut
  // accordion when you tap a row in a differently-grouped list.
  openRepoFor(state.sessions.find((s) => s.id === sessionId)?.folder);
  state.sessionId = sessionId;
  rememberSession(sessionId);
  state.pendingEchoes = [];
  state.paintedFromCache = false;
  loadDraft(sessionId);
  setRail(false);

  // Memory is sync — paint it before the old chat can linger as the wrong one.
  const warm = memoryGet(sessionId);
  if (warm?.records?.length || warm?.head?.length) {
    paintFromCache(warm);
    setHistoryLoading(false);
    sendOp({ op: 'attach', sessionId, fromSeq: cacheAttachSeq(warm) });
    return;
  }

  state.lastSeq = 0;
  state.liveRecords = [];
  state.liveHead = [];
  state.liveEarlier = 0;
  resetChatUi();
  setHistoryLoading(true);
  // Disk may still have it (e.g. after a reload that only warmed this tab's chat).
  loadCache(sessionId).then((cached) => {
    if (state.sessionId !== sessionId) return;
    if (cached?.records?.length || cached?.head?.length) {
      paintFromCache(cached);
      setHistoryLoading(false);
      sendOp({ op: 'attach', sessionId, fromSeq: cacheAttachSeq(cached) });
      return;
    }
    sendOp({ op: 'attach', sessionId, fromSeq: 0 });
  });
}

/**
 * The host fingerprints every file under src/web. When it changes — after a
 * deploy or restart — the running PWA still has the old shell and may be
 * drawing records with stale code; say so and offer a reload.
 */
function noteWebBuild(build) {
  if (!build || !WEB_BUILD || build === WEB_BUILD || updateBannerShown) return;
  updateBannerShown = true;
  const bar = $('update-banner');
  if (!bar) return;
  bar.hidden = false;
}

async function checkWebBuild() {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) return;
    const body = await res.json();
    if (body.webBuild) noteWebBuild(body.webBuild);
  } catch {
    /* host may be restarting */
  }
}

/** Rail header + Settings Host both read from this. */
function setConn(kind, label) {
  els.conn.className = kind === 'ok' ? 'dot ok'
    : kind === 'error' ? 'dot error'
    : 'dot';
  els.conn.title = label;
  els.conn.setAttribute('aria-label', label);
  if (!els.sheet.hidden) {
    $('sheet-conn').textContent = `${label} · ${location.host}`;
  }
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  // Say what is already on screen. The host replays the moment it accepts the
  // socket, so this has to travel with the handshake rather than be asked for
  // afterwards; without it every dropped connection redraws the conversation
  // from scratch, which on a flaky phone connection is most of them.
  // A first load has no lastSeq unless the cache painted first — that used to
  // omit the session entirely, and the host then opened whichever chat was
  // active, not the one this tab had.
  const q = new URLSearchParams();
  const sessionId = state.sessionId || rememberedSession();
  if (sessionId) q.set('session', sessionId);
  if (state.sessionId && sessionId === state.sessionId && state.lastSeq) {
    q.set('fromSeq', String(state.lastSeq));
  }
  const query = q.toString();
  // A reconnect (or a cache hit) that already has the conversation on screen
  // should not cover it; a cold load has nothing else to show.
  if (!state.lastSeq) setHistoryLoading(true);
  const ws = new WebSocket(`${proto}://${location.host}/${query ? `?${query}` : ''}`);
  state.ws = ws;

  ws.onopen = () => setConn('ok', 'Connected');

  ws.onclose = () => {
    setConn('error', 'Reconnecting…');
    setTimeout(connect, 1000);
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'hello') {
      if (msg.webBuild) noteWebBuild(msg.webBuild);
      state.sessions = msg.sessions;
      if (msg.agents) state.agents = msg.agents;
      if (msg.chats) state.chats = msg.chats;
      if (msg.host) applyHost(msg.host);
      if (msg.settings) applySettings(msg.settings);
      renderRail();
      return;
    }

    if (msg.type === 'agents') {
      state.agents = msg.agents || [];
      renderAgentPicker();
      return;
    }

    if (msg.type === 'host') {
      if (msg.host) applyHost(msg.host);
      return;
    }

    if (msg.type === 'settings') {
      applySettings(msg.settings, { rerender: true });
      return;
    }

    if (msg.type === 'desktopRecent') {
      state.chats = msg.chats || [];
      renderRail();
      return;
    }

    if (msg.type === 'sessions') {
      state.sessions = msg.sessions;
      renderRail();
      const mine = msg.sessions.find((s) => s.id === state.sessionId);
      if (mine) {
        applyMeta(mine);
        // A change this tab asked for is resolved server-side (Auto off picks
        // a model), so remember what it settled on once it comes back.
        if (state.modelUpdating && mine.model) rememberModel(mine.agent || 'cursor', mine.model);
      }
      return;
    }

    if (msg.type === 'attached') {
      // The host says whether this stands in for what is on screen. It used to
      // be guessed from the first record being number one, which stopped being
      // true the moment a long transcript arrived as its tail — and a guess of
      // "not fresh" draws the conversation a second time underneath itself.
      // A catch-up that skipped records cannot be appended either: that would
      // leave a hole in the middle of the conversation with nothing to say so.
      const gap = !msg.replaced && msg.earlier > 0;
      const fresh =
        gap || (msg.replaced ?? (msg.sessionId !== state.sessionId || msg.records[0]?.seq === 1));
      const fromCache = state.paintedFromCache;
      state.paintedFromCache = false;
      state.sessionId = msg.sessionId;
      rememberSession(msg.sessionId);
      if (fresh) {
        resetChatUi();
        state.liveRecords = [];
        state.liveHead = [];
        state.liveEarlier = 0;
      }
      renderModels(msg.catalog?.models);
      renderModes(msg.catalog?.modes);
      state.modelControls = null;
      els.modelAuto.checked = false;
      els.modelParameters.innerHTML = '';
      setModelUpdating(false);
      if (msg.modelControls?.status === 'ok') renderModelControls(msg.modelControls);
      else if (msg.meta?.model) paintBuiltinParameters(msg.meta.model);
      if (msg.projects) state.projects = msg.projects;
      if (msg.sidebar) state.sidebar = msg.sidebar;
      if (msg.chats) state.chats = msg.chats;
      state.replaying = true;
      applyMeta(msg.meta);
      // The chat being opened must be reachable, even in a repo left shut.
      openRepoFor(msg.meta?.folder);
      renderRail();
      // Panes first (quiet), so replayed terminal chunks have somewhere to land
      // and the remembered active tab can win after restoreViews.
      for (const t of msg.terminals || []) openPane(t, { activate: false });
      // Cache paint skipped tool tabs (host-owned panes). Restore them on the
      // first attach even when the transcript only caught up.
      if (fresh || fromCache) restoreViews(rememberedViews(msg.sessionId));
      // Opening prompt first (when the tail alone would hide it), then the
      // omission notice, then the newest stretch.
      if (fresh) {
        const omitted =
          msg.omitted != null
            ? msg.omitted
            : msg.head?.length
              ? msg.earlier
              : 0;
        if (!msg.head?.length && msg.earlier > 0) {
          const note = earlierNotice(msg.earlier);
          if (note) add(note);
        }
        paintTranscriptParts(msg.head || [], msg.head?.length ? omitted : 0, msg.records);
      } else {
        ensureOpening(msg.head || [], msg.omitted || 0);
        for (const rec of msg.records) render(rec);
      }
      state.replaying = false;
      applyPendingRestore();
      if (fresh) {
        adoptLive(
          msg.records,
          msg.head?.length ? msg.omitted || 0 : msg.earlier || 0,
          msg.head || [],
        );
      } else if (msg.records.length) {
        const merged = mergeRecords(state.liveRecords, msg.records);
        adoptLive(merged, state.liveEarlier, state.liveHead);
      } else if (state.sessionId) {
        persistLive(state.sessionId);
      }
      if (state.busy) paintLiveStatus();
      else if (state.turn) endTurn({ ts: state.now || Date.now() });
      else settleRunningTools();
      refreshUsage();
      startUsagePoll();
      // An approval the agent is still waiting on outlives the replay window,
      // and a turn stuck behind an unanswered question is the worst thing to
      // come back to. Anything the records already drew is skipped.
      for (const p of msg.pending || []) {
        if (!state.permCards.has(p.requestId)) renderPermission(p);
      }
      if (msg.terminalsAvailable === false) {
        const t = $('term-toggle');
        t.disabled = true;
        t.title = 'Terminals are unavailable on this host';
      }
      decorate(els.transcript);
      scrollDown(true);
      setHistoryLoading(false);
      // Whatever was queued before you looked is still queued.
      sendOp({ op: 'queue.list', sessionId: msg.sessionId });
      if (state.focusComposer) {
        state.focusComposer = false;
        focusComposer();
      }
      if (msg.draft) applyRemoteDraft({ sessionId: msg.sessionId, ...msg.draft });
      return;
    }

    if (msg.type === 'desktopChats') {
      renderDesktopChats(msg.folder, msg.chats || []);
      return;
    }

    if (msg.type === 'projects') {
      state.projects = msg.projects || [];
      if (msg.sidebar) state.sidebar = msg.sidebar;
      renderRail();
      renderNewbie();
      return;
    }

    if (msg.type === 'dirs') {
      renderDirBrowser(msg);
      return;
    }

    if (msg.type === 'synced') {
      state.sessions = msg.sessions || state.sessions;
      renderRail();
      paintNewChat();
      return;
    }

    if (msg.type === 'host.restarting') {
      setConn('', 'Restarting…');
      return;
    }

    if (msg.type === 'catalog') {
      // Catalogs are per agent. A catalog for an agent this tab is not showing
      // must not refill the picker with another agent's models.
      const mine = state.sessions.find((s) => s.id === state.sessionId);
      if (msg.agent && (mine?.agent || 'cursor') !== msg.agent) return;
      renderModels(msg.catalog?.models);
      renderModes(msg.catalog?.modes);
      if (mine?.model) selectModel(mine.model, mine.modelName);
      return;
    }

    if (msg.type === 'model.controls') {
      if (msg.sessionId !== state.sessionId) return;
      renderModelControls(msg);
      // Context size is the denominator under the composer's dial, so a chat
      // whose window just went from 300K to 200K is showing the wrong figure
      // until something asks again.
      refreshUsage(true);
      return;
    }

    if (msg.type === 'model.set' || msg.type === 'model.parameter') {
      if (msg.sessionId !== state.sessionId) return;
      if (msg.type === 'model.set' && !msg.set) setModelUpdating(false);
      return;
    }

    if (msg.type === 'draft') {
      applyRemoteDraft(msg);
      return;
    }

    if (msg.type === 'usage') {
      if (msg.sessionId && msg.sessionId !== state.sessionId) return;
      state.usage = msg;
      paintUsageDial(msg.session);
      if (!els.usageSheet.hidden) renderUsageSheet(msg);
      return;
    }

    if (msg.type === 'record') {
      if (msg.sessionId !== state.sessionId) return;
      render(msg.record);
      return;
    }

    if (msg.type === 'browser.frame') {
      onFrame(msg.data);
      return;
    }

    if (msg.type === 'browser.status') {
      onStatus(msg.status);
      return;
    }

    if (msg.type === 'terminal.opened') {
      if (msg.terminal?.sessionId === state.sessionId) openPane(msg.terminal);
      return;
    }

    if (msg.type === 'terminal.closed') {
      closePane(msg.terminalId);
      return;
    }

    if (msg.type === 'question.answer') {
      const card = state.askCards.get(msg.askId);
      if (!card || card.classList.contains('resolved')) return;
      if (msg.status === 'pressed') return;
      for (const b of card.querySelectorAll('button')) b.disabled = false;
      const outcome = card.querySelector('.outcome');
      if (outcome) outcome.textContent = msg.reason || 'could not answer — try again';
      return;
    }

    if (msg.type === 'plan.build') {
      const card = state.toolCards.get(msg.toolCallId);
      if (!card?.createdPlan) return;
      const outcome = card.querySelector('.outcome');
      if (msg.status === 'pressed') {
        card.classList.add('resolved');
        if (outcome) outcome.textContent = 'Building in Cursor…';
        for (const b of card.querySelectorAll('button, select')) {
          if (!b.classList.contains('view')) b.disabled = true;
        }
        if (state.openPlanCard === card) {
          els.planBuild.disabled = true;
          els.planBuildModel.disabled = true;
          els.planOutcome.textContent = 'Building in Cursor…';
        }
        return;
      }
      for (const b of card.querySelectorAll('button, select')) {
        if (!b.classList.contains('view')) b.disabled = false;
      }
      const build = card.querySelector('.build');
      if (build) delete build.dataset.sent;
      if (outcome) outcome.textContent = msg.reason || 'could not build — try again';
      if (state.openPlanCard === card) {
        delete els.planBuild.dataset.sent;
        els.planBuild.disabled = false;
        els.planBuildModel.disabled = false;
        els.planOutcome.textContent = msg.reason || 'could not build — try again';
      }
      return;
    }

    if (msg.type === 'queue') {
      if (msg.sessionId && msg.sessionId !== state.sessionId) return;
      state.queue = {
        owner: msg.owner || 'auto',
        waiting: msg.waiting || 0,
        items: msg.items || [],
        hidden: msg.hidden || 0,
        reason: msg.reason || null,
      };
      // An action that failed is worth a word: the message may have gone into
      // the agent between the list being drawn and the button being pressed.
      if (msg.acted && msg.acted.status !== 'done') {
        render({ kind: 'notice', text: msg.acted.reason || `That queued message is ${msg.acted.status}.` });
      }
      renderQueue();
      return;
    }

    if (msg.type === 'error') {
      setHistoryLoading(false);
      if (!els.modelSheet.hidden && state.modelUpdating) {
        setModelUpdating(false);
        els.modelStatus.textContent = msg.message;
      }
      if (!$('newbie').hidden && !$('newbie-browser').hidden) {
        $('newbie-note').textContent = msg.message;
      }
      render({ kind: 'error', text: msg.message });
    }
  };
}

// ---------------------------------------------------------------- composer

function renderAttachments() {
  els.attachments.innerHTML = '';
  els.attachments.hidden = state.attachments.length === 0;
  syncSend();
  state.attachments.forEach((att, i) => {
    const box = div('att');
    const img = document.createElement('img');
    img.src = att.url;
    img.alt = att.name || 'attached image';
    img.title = 'View image';
    img.onclick = () => openLightbox(att.url);
    const drop = document.createElement('button');
    drop.type = 'button';
    drop.textContent = '×';
    drop.title = 'Remove';
    drop.setAttribute('aria-label', 'Remove image');
    drop.onclick = (e) => {
      e.stopPropagation();
      state.attachments.splice(i, 1);
      renderAttachments();
    };
    box.append(img, drop);
    els.attachments.append(box);
  });
}

/**
 * The messages waiting for the turn to end, above the box you typed them in.
 *
 * The same three things the IDE offers, because a message queued from a phone is
 * the one most likely to need taking back: reword it, push it to the front, or
 * throw it away. Rewording happens in the row itself rather than in the message
 * box, so a half-typed follow-up is never overwritten by an edit.
 */
function renderQueue() {
  const { items, waiting, hidden, owner, reason } = state.queue;
  const none = !waiting && !items.length;
  els.queue.hidden = none;
  if (none) {
    state.editing = null;
    return;
  }

  // Open on the first sight of a queue, then leave it however it was left.
  if (!els.queue.dataset.touched) els.queue.open = true;
  const extra = hidden ? ` (${hidden} out of view)` : '';
  els.queueCount.textContent = `${waiting} queued${extra}`;
  els.queue.title = owner === 'cursor' ? 'Held by Cursor until this turn ends' : '';

  els.queueList.innerHTML = '';
  if (reason) els.queueList.append(said('queue-note', `Cursor's queue is out of reach: ${reason}`));

  for (const item of items) {
    const row = div('queued');
    if (state.editing === item.id) {
      const editor = document.createElement('textarea');
      editor.value = item.text;
      editor.rows = Math.min(6, item.text.split('\n').length + 1);
      const save = button('✓', 'Save', () => {
        const text = editor.value.trim();
        state.editing = null;
        if (text && text !== item.text) {
          sendOp({ op: 'queue.edit', sessionId: state.sessionId, itemId: item.id, text });
        } else {
          renderQueue();
        }
      });
      const cancel = button('×', 'Cancel', () => {
        state.editing = null;
        renderQueue();
      });
      const acts = div('queued-acts');
      acts.append(save, cancel);
      row.append(editor, acts);
      els.queueList.append(row);
      editor.focus();
      continue;
    }

    const text = said('queued-text', item.text);
    if (item.images) {
      text.append(said('cap', `+${item.images} image${item.images === 1 ? '' : 's'}`));
    }
    const acts = div('queued-acts');
    acts.append(
      button('✎', 'Edit this message', () => {
        state.editing = item.id;
        renderQueue();
      }),
      button('↑', owner === 'cursor' ? 'Send it now' : 'Send it next', () =>
        sendOp({ op: 'queue.now', sessionId: state.sessionId, itemId: item.id }),
      ),
      button('🗑', 'Delete this message', () =>
        sendOp({ op: 'queue.drop', sessionId: state.sessionId, itemId: item.id }),
      ),
    );
    row.append(text, acts);
    els.queueList.append(row);
  }
}

/** A div holding words, never markup: a queued message is somebody's typing. */
function said(cls, words) {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = words;
  return d;
}

/** A small square button, the only kind the queue rows need. */
function button(face, title, onclick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'queued-act';
  b.textContent = face;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.onclick = onclick;
  return b;
}

/** Screenshots are half of what you want to say from a phone. */
function addImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result);
    state.attachments.push({
      mimeType: file.type,
      data: url.slice(url.indexOf(',') + 1),
      url,
      name: file.name,
    });
    renderAttachments();
  };
  reader.readAsDataURL(file);
}

function submit(text) {
  const body = (text ?? els.box.value).trim();
  const images = state.attachments.map(({ mimeType, data, url }) => ({ mimeType, data, url }));
  // A turn already running is no reason to refuse: the host queues it.
  if (!body && !images.length) return;
  state.lastPrompt = body;
  // Idle sends go on the stream at once — waiting for Cursor's window made
  // the phone look like nothing had been sent. A busy turn queues instead,
  // and the queue is where those belong until they go in.
  if (!state.busy) {
    renderUser({
      text: body,
      images: images.length || undefined,
      imageParts: images.length
        ? images.map(({ mimeType, data, url }) => ({ mimeType, data, url }))
        : undefined,
    });
    rememberSend({ text: body, images: images.length || 0 });
  }
  sendOp({
    op: 'prompt',
    sessionId: state.sessionId,
    text: body,
    images: images.map(({ mimeType, data }) => ({ mimeType, data })),
  });
  state.attachments = [];
  renderAttachments();
  if (text === undefined) {
    els.box.value = '';
    autosize();
  }
  clearDraft(state.sessionId);
  scrollDown(true);
}

function autosize() {
  els.box.style.height = 'auto';
  els.box.style.height = `${Math.min(els.box.scrollHeight, window.innerHeight * 0.4)}px`;
  syncSend();
}

// ------------------------------------------------------------------ slash

/**
 * Slash commands in the chat box, the way ChatGPT opens them: typing `/`
 * lists them, a command with choices opens a second page, and Escape steps
 * back one page at a time — choices, then the command list, then the input.
 *
 * Every command here is an existing action reached from a phone-sized list,
 * so nothing new has to be learned; the verbosity choices are the same host
 * setting as Settings → Chat detail.
 */
const slash = { open: false, level: 'commands', command: null, index: 0, items: [] };

function slashCommands() {
  return [
    {
      id: 'verbosity',
      name: 'Verbosity',
      hint: 'How much tool detail a chat shows',
      current: () => state.verbosity,
      options: [
        { value: 'quiet', name: 'Quiet', hint: 'Summarise each turn' },
        { value: 'normal', name: 'Normal', hint: 'Activity lines, edits, commands' },
        { value: 'verbose', name: 'Verbose', hint: 'Tool inputs and raw output' },
      ],
      run: (value) => {
        applySettings({ verbosity: value }, { rerender: true });
        sendOp({ op: 'host.verbosity', level: value });
      },
    },
    {
      id: 'mode',
      name: 'Mode',
      hint: 'How the agent works',
      current: () => els.mode.value,
      options: () => [...els.mode.options].map((o) => ({ value: o.value, name: o.textContent })),
      run: (value) => {
        els.mode.value = value;
        els.mode.onchange();
      },
    },
    {
      id: 'policy',
      name: 'Approvals',
      hint: 'When to ask before acting',
      current: () => els.policy.value,
      options: [
        { value: 'ask', name: 'Ask every time' },
        { value: 'ask-on-write', name: 'Ask before writes' },
        { value: 'auto', name: 'Auto-approve' },
      ],
      run: (value) => {
        els.policy.value = value;
        els.policy.onchange();
      },
    },
    {
      id: 'model',
      name: 'Model',
      hint: 'Choose a model and its parameters',
      run: () => {
        setModelSheet(true);
      },
    },
    { id: 'new', name: 'New session', hint: 'Start in a folder', run: () => $('new-session').click() },
    { id: 'stop', name: 'Stop', hint: 'Interrupt the current turn', run: () => els.stop.onclick() },
    { id: 'settings', name: 'Settings', hint: 'Theme, host, chat detail', run: () => $('sheet-open').click() },
    { id: 'sync', name: 'Refresh sessions', hint: 'Re-read the agent and Cursor', run: () => sendOp({ op: 'sessions.sync' }) },
    {
      id: 'restart',
      name: 'Restart Auto',
      hint: 'Wait for the turn, then reapply changes',
      run: () => $('restart').click(),
    },
  ];
}

/** A small inline glyph for a slash row. */
function slashSpan(cls, text) {
  const span = document.createElement('span');
  span.className = cls;
  span.textContent = text;
  return span;
}

const slashOptions = (command) => {
  const options = typeof command.options === 'function' ? command.options() : command.options;
  return Array.isArray(options) ? options : [];
};

const slashHasOptions = (command) => slashOptions(command).length > 0;

/** The text after `/`, or null when the box is not a command being typed. */
function slashQuery() {
  const value = els.box.value;
  if (!value.startsWith('/')) return null;
  const rest = value.slice(1);
  if (/\s/.test(rest)) return null;
  return rest.toLowerCase();
}

function renderSlash(query = '') {
  const list = $('slash-list');
  if (!list) return;
  list.innerHTML = '';

  if (slash.level === 'options' && slash.command) {
    slash.items = slashOptions(slash.command).map((opt) => ({ kind: 'option', opt }));
  } else {
    const q = String(query || '').toLowerCase();
    slash.items = slashCommands()
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.id.includes(q) ||
          (c.hint || '').toLowerCase().includes(q),
      )
      .map((command) => ({ kind: 'command', command }));
  }

  const current = slash.level === 'options' ? slash.command?.current?.() : null;
  for (const [i, item] of slash.items.entries()) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'slash-row';
    row.setAttribute('role', 'option');

    const name = document.createElement('span');
    name.className = 'slash-name';
    const hint = document.createElement('span');
    hint.className = 'slash-hint';

    if (item.kind === 'command') {
      name.textContent = item.command.name;
      hint.textContent = item.command.hint || '';
      row.append(name, hint);
      if (slashHasOptions(item.command)) row.append(slashSpan('slash-chevron', '›'));
    } else {
      name.textContent = item.opt.name;
      hint.textContent = item.opt.hint || '';
      row.append(name, hint);
      if (current != null && current === item.opt.value) row.append(slashSpan('slash-check', '✓'));
    }

    row.onmouseenter = () => {
      slash.index = i;
      paintSlashActive();
    };
    row.onclick = () => slashChoose(i);
    list.append(row);
  }

  if (!slash.items.length) {
    list.append(said('slash-empty', slash.level === 'options' ? 'No options.' : 'No matching command.'));
  }
  if (slash.index >= slash.items.length) slash.index = Math.max(0, slash.items.length - 1);
  paintSlashActive();
}

function paintSlashActive() {
  const rows = [...$('slash-list').querySelectorAll('.slash-row')];
  rows.forEach((row, i) => {
    const active = i === slash.index;
    row.classList.toggle('active', active);
    row.setAttribute('aria-selected', String(active));
  });
  rows[slash.index]?.scrollIntoView({ block: 'nearest' });
}

function slashSetLevel(level, command) {
  slash.open = true;
  slash.level = level;
  slash.command = command || null;
  if (level === 'options' && command) {
    const at = slashOptions(command).findIndex((o) => o.value === command.current?.());
    slash.index = at >= 0 ? at : 0;
  } else {
    slash.index = 0;
  }
  const panel = $('slash');
  panel.hidden = false;
  panel.querySelector('.slash-head').hidden = level !== 'options';
  $('slash-title').textContent = command?.name || '';
  renderSlash(level === 'commands' ? slashQuery() || '' : '');
}

function slashClose() {
  slash.open = false;
  slash.level = 'commands';
  slash.command = null;
  slash.index = 0;
  slash.items = [];
  const panel = $('slash');
  if (panel) panel.hidden = true;
}

/** Everything that was typed to reach the palette is the palette's, not a message. */
function clearSlashText() {
  if (slashQuery() === null) return;
  els.box.value = '';
  clearDraft(state.sessionId);
  autosize();
}

function slashBack() {
  if (slash.level === 'options') {
    slashSetLevel('commands', null);
    return;
  }
  slashClose();
  els.box.focus({ preventScroll: true });
}

function slashMove(delta) {
  const count = slash.items.length;
  if (!count) return;
  slash.index = (slash.index + delta + count) % count;
  paintSlashActive();
}

function slashChoose(i) {
  const item = slash.items[i];
  if (!item) return;
  if (item.kind === 'command') {
    if (slashHasOptions(item.command)) {
      const command = item.command;
      clearSlashText();
      slashSetLevel('options', command);
      // A tap on a row blurs the box; put the caret back so keys keep working.
      els.box.focus({ preventScroll: true });
      return;
    }
    const command = item.command;
    slashClose();
    clearSlashText();
    command.run?.();
    return;
  }
  const command = slash.command;
  slashClose();
  clearSlashText();
  command?.run?.(item.opt.value);
  els.box.focus({ preventScroll: true });
}

/** Keyboard while the palette is open: arrows move, Enter picks, Escape steps back. */
function slashKey(e) {
  if (!slash.open) return false;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    slashBack();
    return true;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    slashMove(e.key === 'ArrowDown' ? 1 : -1);
    return true;
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    e.stopPropagation();
    slashChoose(slash.index);
    return true;
  }
  return false;
}

/** Follow what is typed: `/` opens the list, more letters filter it. */
function slashSync() {
  const query = slashQuery();
  if (query === null) {
    if (slash.open) slashClose();
    return;
  }
  if (!slash.open) {
    slashSetLevel('commands', null);
    return;
  }
  if (slash.level === 'commands') renderSlash(query);
}

$('slash-back').onclick = () => slashBack();

// Folding the queue away is a choice worth keeping; the count stays visible.
els.queue.addEventListener('toggle', () => {
  els.queue.dataset.touched = '1';
});

els.send.onclick = () => submit();
els.stop.onclick = () => sendOp({ op: 'cancel', sessionId: state.sessionId });
els.box.addEventListener('input', () => {
  autosize();
  slashSync();
  saveDraft();
  els.send.disabled = !(els.box.value.trim() || state.attachments.length);
});
els.box.addEventListener('keydown', (e) => {
  if (slashKey(e)) return;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    submit();
  }
});
els.box.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  files.forEach(addImage);
});

// An image dragged onto the composer lands the same way a pasted one does.
// Without turning the drag away the browser navigates to the file and the
// whole app disappears, so every drop that carries files is claimed.
const dropBox = document.querySelector('.composer-box');
const dragHasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
let dragDepth = 0;
const dropImages = (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropBox.classList.remove('dropping');
  const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
  files.forEach(addImage);
};
dropBox.addEventListener('dragenter', (e) => {
  if (!dragHasFiles(e)) return;
  e.preventDefault();
  dragDepth += 1;
  dropBox.classList.add('dropping');
});
dropBox.addEventListener('dragover', (e) => {
  if (!dragHasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
dropBox.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropBox.classList.remove('dropping');
});
dropBox.addEventListener('drop', dropImages);
// A file aimed slightly wide of the field would still be opened by the
// browser; swallow those too so the page stays put.
window.addEventListener('dragover', (e) => { if (dragHasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', (e) => { if (dragHasFiles(e)) e.preventDefault(); });

$('attach').onclick = () => els.file.click();
els.file.onchange = () => {
  [...els.file.files].forEach(addImage);
  els.file.value = '';
};

els.transcript.addEventListener('scroll', () => {
  syncToBottom();
  onTranscriptScroll();
}, { passive: true });
els.toBottom.onclick = () => {
  scrollDownSmooth();
  syncToBottom();
};
bindScrubber();

// --------------------------------------------------------- new session

/** The model sheet sits below this — chrome, not chat, stays out of its scrim. */
function syncTopbarHeight() {
  if (!els.topbar) return;
  const top = els.topbar.getBoundingClientRect().top;
  let bottom = els.topbar.getBoundingClientRect().bottom;
  const banner = $('update-banner');
  if (banner && !banner.hidden) {
    bottom = Math.max(bottom, banner.getBoundingClientRect().bottom);
  }
  const tabs = $('view-tabs');
  if (tabs && !tabs.hidden) {
    bottom = Math.max(bottom, tabs.getBoundingClientRect().bottom);
  }
  const h = Math.round(bottom - top);
  if (!h) return;
  document.documentElement.style.setProperty('--topbar-h', `${h}px`);
}

/**
 * Soft keyboards shrink the visual viewport without shrinking the layout one.
 * Publish that frame as --vv-top / --vv-height so the New session sheet (and
 * anything else that wants it) can sit above the keys instead of under them.
 */
function syncVisualViewport() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (!vv) {
    root.style.removeProperty('--vv-top');
    root.style.removeProperty('--vv-height');
    return;
  }
  root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
  root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
  syncTopbarHeight();
  fitStandaloneShell();
}

/**
 * iOS Home Screen: the layout viewport stops above the home indicator, which
 * reads as a white strip under the composer. Size the shell to the visual
 * viewport (the pixels you can see) and keep composer padding at 8px — never
 * env(safe-area-inset-bottom), which is ~80px here even with the keyboard up.
 */
function fitStandaloneShell() {
  if (!document.documentElement.hasAttribute('data-standalone')) return;
  const app = $('app');
  const composer = els.composer;
  const vv = window.visualViewport;
  if (app && vv) {
    app.style.top = `${Math.round(vv.offsetTop)}px`;
    app.style.height = `${Math.round(vv.height)}px`;
    app.style.left = '0';
    app.style.right = '0';
    app.style.bottom = 'auto';
  }
  if (composer) composer.style.setProperty('padding-bottom', '8px', 'important');
  syncComposerHeight();
}

/**
 * The composer floats over the transcript. Measure it so the last bubble,
 * the jump button, and the scrub rail all clear the field — and so messages
 * can still scroll through the fade underneath.
 */
function syncComposerHeight() {
  const view = els.viewChat;
  const composer = els.composer;
  if (!view || !composer) return;
  const h = Math.ceil(composer.getBoundingClientRect().height);
  if (!h) return;
  const prev = view.style.getPropertyValue('--composer-height');
  const next = `${h}px`;
  if (prev === next) return;
  const stick = nearBottom();
  view.style.setProperty('--composer-height', next);
  if (stick) scrollDown(true);
}

{
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', syncVisualViewport);
    vv.addEventListener('scroll', syncVisualViewport);
  }
  window.addEventListener('resize', syncVisualViewport);
  syncVisualViewport();
  if (els.composer && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(syncComposerHeight).observe(els.composer);
  }
  syncComposerHeight();
}

/**
 * Mark a scroller `.is-scrolling` while the finger/wheel is moving so the
 * thin overlay thumb (CSS) appears the way macOS shows bars on scroll.
 */
function bindOverlayScrollbars() {
  const timers = new WeakMap();
  document.addEventListener(
    'scroll',
    (e) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      el.classList.add('is-scrolling');
      const prev = timers.get(el);
      if (prev) clearTimeout(prev);
      timers.set(
        el,
        setTimeout(() => {
          el.classList.remove('is-scrolling');
          timers.delete(el);
        }, 800),
      );
    },
    { capture: true, passive: true },
  );
}

/**
 * Starting a session is choosing where it works. The list is Cursor's own
 * project list rather than anything Auto invented, and a folder can always be
 * typed by hand for the project nobody has opened in a while. When that folder
 * is already open in Cursor, the new session is a chat in the IDE.
 */
function setNewbie(open) {
  $('newbie').hidden = !open;
  if (!open) return;
  syncVisualViewport();
  $('newbie-filter').value = '';
  $('newbie-path').value = '';
  $('newbie-note').textContent = '';
  dirBrowserOpen(false);
  renderNewbie();
  // Start each sheet on the configured default agent, not last visit's choice.
  state.newbieAgent = null;
  renderAgentPicker();
  // The rail's copy may be stale; the host re-reads Cursor's records on ask.
  sendOp({ op: 'projects.list' });
  sendOp({ op: 'agents.list' });
  $('newbie-filter').focus();
}

/** The same fallback the rail uses: sessions prove a folder was a project. */
function projectChoices() {
  if (state.projects.length) return state.projects;
  return [...new Set(state.sessions.map((s) => s.folder))].map((path) => ({
    path,
    name: (path || '').split(/[\\/]/).pop(),
    open: false,
  }));
}

function renderNewbie() {
  const list = $('newbie-list');
  if ($('newbie').hidden) return;
  const filter = $('newbie-filter').value.trim().toLowerCase();
  list.innerHTML = '';

  const choices = projectChoices().filter(
    (p) =>
      !filter ||
      (p.name || '').toLowerCase().includes(filter) ||
      (p.path || '').toLowerCase().includes(filter),
  );

  for (const p of choices) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'newbie-row';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = p.name || p.path;
    const path = document.createElement('span');
    path.className = 'path';
    path.textContent = p.path || '';
    row.append(name, path);
    if (p.open) {
      const tag = document.createElement('span');
      tag.className = 'open-here';
      tag.textContent = 'open in Cursor';
      row.append(tag);
    }
    row.onclick = () => createSession(p.path, state.newbieAgent);
    list.append(row);
  }

  if (!choices.length) {
    list.append(
      said(
        'queue-note',
        filter ? 'Nothing matches that filter.' : 'No projects yet — type a folder path below.',
      ),
    );
  }
}

/**
 * Which agent a new session drives.
 *
 * Cursor is a chat in its own window; opencode is an Auto-only ACP process.
 * The choice only appears when more than one agent is actually installed —
 * a picker with one option is noise.
 */
function renderAgentPicker() {
  const block = $('newbie-agent-block');
  const row = $('newbie-agents');
  const note = $('newbie-agent-note');
  if (!block || !row) return;
  const usable = (state.agents || []).filter((a) => a.available);
  if (usable.length < 2) {
    block.hidden = true;
    row.innerHTML = '';
    note.textContent = '';
    state.newbieAgent = null;
    return;
  }
  if (!usable.some((a) => a.name === state.newbieAgent)) {
    state.newbieAgent = (usable.find((a) => a.default) || usable[0]).name;
  }
  block.hidden = false;
  row.innerHTML = '';
  for (const agent of usable) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'agent-choice' + (agent.name === state.newbieAgent ? ' selected' : '');
    btn.append(agentMark({ agent: agent.name, session: true, status: 'idle' }));
    btn.append(document.createTextNode(agent.name));
    btn.title =
      agent.name === 'opencode'
        ? 'Runs opencode over ACP — approvals and model are opencode\'s own'
        : 'Runs a Cursor chat when a window already has this folder';
    btn.onclick = () => {
      state.newbieAgent = agent.name;
      renderAgentPicker();
    };
    row.append(btn);
  }
  note.textContent =
    state.newbieAgent === 'opencode'
      ? 'Auto-only session: opencode runs in the background, not in Cursor.'
      : 'A Cursor chat when the folder is open, otherwise Auto hosts the agent.';
}

/** The folder SVG a directory-browser row carries. */
const FOLDER_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  </svg>`;

/**
 * Browsing the machine for a folder the project list does not know. The host
 * lists drives and directories; a folder is entered by tapping it and chosen
 * with one button, because a phone has no file dialog worth using.
 */
function dirBrowserOpen(open) {
  const panel = $('newbie-browser');
  if (!panel) return;
  panel.hidden = !open;
  if (open) return;
  state.dirPath = null;
  state.dirParent = null;
  $('dir-list').innerHTML = '';
}

function browseTo(path) {
  dirBrowserOpen(true);
  $('newbie-note').textContent = 'Loading…';
  sendOp({ op: 'fs.list', ...(path ? { path } : {}) });
}

function renderDirBrowser(msg) {
  state.dirPath = msg.path || null;
  state.dirParent = msg.parent || null;
  const list = $('dir-list');
  if (!list) return;
  list.innerHTML = '';
  $('newbie-note').textContent = '';

  const where = msg.path || 'This computer';
  $('dir-path').textContent = where;
  $('dir-path').title = where;
  $('newbie-path').value = msg.path || '';
  $('dir-up').disabled = !msg.path;
  $('dir-choose').hidden = !msg.path;

  const entries = msg.entries || [];
  for (const entry of entries) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'dir-row';
    const icon = div('dir-icon');
    icon.innerHTML = FOLDER_ICON;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.name;
    name.title = entry.path;
    row.append(icon, name);
    row.onclick = () => browseTo(entry.path);
    list.append(row);
  }
  if (!entries.length) list.append(said('queue-note', 'No folders here.'));
}

/**
 * The model you last chose, remembered per agent. A new session opens on it
 * instead of Auto-select — picking "Deepseek" once should not mean picking it
 * again every time. Kept per agent because model ids mean nothing across
 * catalogs: an opencode slug is not a Cursor one.
 */
const modelKey = (agent) => `auto.model.${agent || 'cursor'}`;

function preferredModel(agent) {
  try {
    return localStorage.getItem(modelKey(agent)) || null;
  } catch {
    return null;
  }
}

function rememberModel(agent, modelId) {
  if (!modelId) return;
  try {
    localStorage.setItem(modelKey(agent), modelId);
  } catch {
    /* private mode */
  }
}

/** Which agent drives the session in view, for remembering its model. */
function sessionAgent(sessionId = state.sessionId) {
  return state.sessions.find((s) => s.id === sessionId)?.agent || 'cursor';
}

function createSession(folder, agent = null) {
  const path = String(folder || '').trim();
  if (!path) return;
  setNewbie(false);
  // Focus now (user gesture) and again after attach lands the empty chat.
  state.focusComposer = true;
  focusComposer();
  // The host defaults the agent when we do not name one; naming the default
  // here lets the remembered model travel with it.
  const who =
    agent || state.newbieAgent || state.agents.find((a) => a.default)?.name || null;
  const model = preferredModel(who || 'cursor');
  sendOp({
    op: 'session.create',
    folder: path,
    ...(who ? { agent: who } : {}),
    ...(model ? { model } : {}),
  });
}

/** Same-repo empty chat from the topbar — no project picker. */
$('new-chat').onclick = () => {
  const folder = currentFolder();
  if (!folder) return;
  const mine = state.sessions.find((s) => s.id === state.sessionId);
  createSession(folder, mine?.agent || null);
};

$('new-session').onclick = () => {
  // The rail covers the screen on a phone; the dialog has to sit above it.
  setRail(false);
  setNewbie(true);
};

$('rail-new').onclick = () => $('new-session').click();
$('rail-search').onclick = () => {
  const input = $('rail-filter');
  input.hidden = !input.hidden;
  if (!input.hidden) input.focus();
  else {
    input.value = '';
    renderRail();
  }
};
$('rail-filter').addEventListener('input', () => {
  if (!$('rail-filter').value.trim()) renderRail();
  else applyRailFilter();
});
$('rail-customize').onclick = () => $('sheet-open').click();

function applyRailFilter() {
  const q = ($('rail-filter')?.value || '').trim().toLowerCase();
  if (!els.rail) return;
  for (const repo of els.rail.querySelectorAll('.repo')) {
    let any = !q;
    for (const row of repo.querySelectorAll('.session')) {
      const name = row.querySelector('.name')?.textContent?.toLowerCase() || '';
      const show = !q || name.includes(q);
      if (q) row.hidden = !show;
      if (show) any = true;
    }
    const title = repo.querySelector('.repo-name')?.textContent?.toLowerCase() || '';
    repo.hidden = Boolean(q) && !any && !title.includes(q);
    if (q && (any || title.includes(q))) repo.open = true;
  }
  for (const row of els.rail.querySelectorAll('.rail-projects .session')) {
    const name = row.querySelector('.name')?.textContent?.toLowerCase() || '';
    if (q) row.hidden = !name.includes(q);
  }
}
$('newbie-close').onclick = () => setNewbie(false);
$('newbie').onclick = (e) => {
  if (e.target === $('newbie')) setNewbie(false);
};
$('newbie-filter').addEventListener('input', renderNewbie);
$('newbie-create').onclick = () => createSession($('newbie-path').value, state.newbieAgent);
$('newbie-path').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createSession($('newbie-path').value, state.newbieAgent);
});
$('newbie-browse').onclick = () =>
  browseTo($('newbie-path').value.trim() || state.dirPath || null);
$('dir-up').onclick = () => {
  if (state.dirParent) browseTo(state.dirParent);
};
$('dir-choose').onclick = () => {
  if (!state.dirPath) return;
  $('newbie-path').value = state.dirPath;
  dirBrowserOpen(false);
};

$('restart').onclick = () => {
  if (!confirm('Restart Auto? It waits for the current turn, then reconnects.')) return;
  sendOp({ op: 'host.restart', reason: 'web' });
};
/**
 * Open or close the session rail. On a narrow screen it slides over the page,
 * covering the button that opened it — so closing has to be possible from the
 * rail itself (× or a swipe left), from the page beside it, and from the keyboard.
 */
function setRail(open) {
  els.app.classList.toggle('rail-open', open);
  $('rail-scrim').hidden = !open;
  $('rail').style.transform = '';
  els.app.classList.remove('rail-dragging');
  // Cursor may have moved on since you last looked.
  if (open) sendOp({ op: 'desktop.recent' });
}

/**
 * The rail is a drawer on a narrow screen. Swiping it left closes it the
 * same way the × and the scrim do — following the finger, then settling.
 *
 * Pointer events never see the swipe on iOS: the session list is a scroller,
 * so Safari eats the gesture as a pan and `pointermove` never fires. A
 * non-passive `touchmove` has to be on the rail before the finger goes down,
 * or iOS will not let it cancel the scroll.
 */
function bindRailSwipe() {
  const rail = $('rail');
  const list = $('session-list');
  const overlay = () => window.matchMedia('(max-width: 760px)').matches;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastT = 0;
  let vx = 0;
  let mode = 'idle';

  const finger = (e) => {
    const t = e.changedTouches?.[0] || e.touches?.[0];
    return t
      ? { x: t.clientX, y: t.clientY, t: e.timeStamp }
      : { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };

  const settle = (close) => {
    const dragged = mode === 'drag';
    mode = 'idle';
    els.app.classList.remove('rail-dragging');
    list.style.overflow = '';
    if (close) {
      // Keep the finger's offset until rail-open drops, or the drawer
      // would jump fully open and then animate closed.
      els.app.classList.remove('rail-open');
      $('rail-scrim').hidden = true;
      requestAnimationFrame(() => {
        rail.style.transform = '';
      });
    } else {
      rail.style.transform = '';
    }
    if (!dragged) return;
    // A swipe that ends on a row must not attach or archive it. preventDefault
    // on touchmove often cancels that gesture's click entirely, so a bare
    // once-listener would sit until the *next* open and eat the first tap —
    // the hamburger then looked like it refused to switch chats. Bound the
    // guard to this gesture only.
    const eat = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      clearTimeout(eatTimer);
    };
    rail.addEventListener('click', eat, { capture: true, once: true });
    const eatTimer = setTimeout(() => {
      rail.removeEventListener('click', eat, true);
    }, 400);
  };

  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    if (mode === 'idle') return;
    const p = finger(e);
    const dx = p.x - startX;
    const dy = p.y - startY;
    const dt = p.t - lastT || 1;
    vx = (p.x - lastX) / dt;
    lastX = p.x;
    lastT = p.t;

    if (mode === 'maybe') {
      // Match the archive × slop: a normal tap jitters a few pixels, and
      // treating that as a swipe both closes nothing and eats the row click.
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      // Vertical scroll of the list wins; swiping right has nowhere to go.
      if (dx > -10 || Math.abs(dy) >= Math.abs(dx)) {
        mode = 'idle';
        return;
      }
      mode = 'drag';
      els.app.classList.add('rail-dragging');
      list.style.overflow = 'hidden';
    }

    if (e.cancelable) e.preventDefault();
    rail.style.transform = `translateX(${Math.min(0, dx)}px)`;
  };

  const onEnd = (e) => {
    if (e.pointerType === 'touch') return;
    if (mode === 'idle') return;
    const dx = finger(e).x - startX;
    const width = rail.getBoundingClientRect().width || 280;
    settle(mode === 'drag' && (dx < -width * 0.18 || (dx < -24 && vx < -0.25)));
  };

  const onCancel = (e) => {
    if (e.pointerType === 'touch') return;
    if (mode === 'idle') return;
    settle(false);
  };

  const onStart = (e) => {
    if (!overlay() || !els.app.classList.contains('rail-open')) return;
    if (e.type === 'pointerdown' && e.pointerType === 'touch') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest?.('button, input, select, textarea, a')) return;
    const p = finger(e);
    startX = lastX = p.x;
    startY = p.y;
    lastT = p.t;
    vx = 0;
    mode = 'maybe';
  };

  rail.addEventListener('touchstart', onStart, { capture: true, passive: true });
  rail.addEventListener('touchmove', onMove, { capture: true, passive: false });
  rail.addEventListener('touchend', onEnd, { capture: true });
  rail.addEventListener('touchcancel', onCancel, { capture: true });
  rail.addEventListener('pointerdown', onStart);
  rail.addEventListener('pointermove', onMove);
  rail.addEventListener('pointerup', onEnd);
  rail.addEventListener('pointercancel', onCancel);
}

$('rail-toggle').onclick = () => setRail(!els.app.classList.contains('rail-open'));
$('rail-close').onclick = () => setRail(false);
$('rail-scrim').onclick = () => setRail(false);
bindRailSwipe();

// --------------------------------------------------------------- appearance

/**
 * Three choices, not two: a phone that turns light at sunrise should take the
 * app with it unless you have said otherwise. The stored preference is the
 * choice ("system"), never the outcome ("light").
 */
const THEME_KEY = 'auto.theme';
const prefersLight = window.matchMedia('(prefers-color-scheme: light)');

function themeChoice() {
  try {
    return localStorage.getItem(THEME_KEY) || 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(choice = themeChoice()) {
  const light = choice === 'light' || (choice === 'system' && prefersLight.matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';

  // The browser's own chrome should not be the one thing left behind.
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (meta && bg) meta.setAttribute('content', bg);

  for (const b of document.querySelectorAll('#theme-seg button')) {
    b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice));
  }
  retheme();
  syncBrowserTheme();
}

for (const b of document.querySelectorAll('#theme-seg button')) {
  b.onclick = () => {
    try {
      localStorage.setItem(THEME_KEY, b.dataset.themeChoice);
    } catch {
      /* private mode: the choice lasts as long as the page does */
    }
    applyTheme(b.dataset.themeChoice);
  };
}

for (const b of document.querySelectorAll('#verbosity-seg button')) {
  b.onclick = () => {
    // Optimistic, then the host persists and broadcasts to every client.
    applySettings({ verbosity: b.dataset.verbosityChoice }, { rerender: true });
    sendOp({ op: 'host.verbosity', level: b.dataset.verbosityChoice });
  };
}

prefersLight.addEventListener('change', () => {
  if (themeChoice() === 'system') applyTheme();
});

// -------------------------------------------------------------------- sheet

/**
 * Everything that is not the conversation. Mode and model stay in the
 * composer at every width, the way Cursor's chat box carries them — they say
 * what the next message will run as. The approval policy is the rare change,
 * so it alone moves into the sheet on a narrow screen, which is how it used
 * to go missing on a phone, the one place it matters most.
 */
const compact = window.matchMedia('(max-width: 900px)');

function placeControls() {
  const inSheet = compact.matches;
  const host = inSheet ? $('sheet-controls') : $('topbar-controls');
  host.append(els.policy);
  // Whichever holder is left empty should not keep its gap.
  $('sheet-controls').hidden = !inSheet;
}

function setSheet(open) {
  els.sheet.hidden = !open;
  if (!open) return;
  $('rename').value = state.sessionId ? els.title.textContent : '';
  $('sheet-folder').textContent = els.folder.textContent;
  $('host-nick').value = state.host.nick || '';
  $('host-nick').placeholder = state.host.hostname || 'Display name';
  $('sheet-hostname').textContent = state.host.hostname
    ? `hostname · ${state.host.hostname}`
    : '';
  $('sheet-conn').textContent = `${els.conn.title || '…'} · ${location.host}`;
}

/** Rail brand + Settings Host both read from this. Tab title leads with the
 *  host so a glance at the browser chrome shows which machine this is. */
function applyHost(host) {
  state.host = {
    hostname: host.hostname || '',
    nick: host.nick || null,
    label: host.label || host.nick || host.hostname || '',
  };
  const el = $('host-label');
  if (el) el.textContent = state.host.label || '…';
  document.title = state.host.label ? `${state.host.label} · RS Cursor` : 'RS Cursor';
  if (!els.sheet.hidden) {
    $('host-nick').value = state.host.nick || '';
    $('host-nick').placeholder = state.host.hostname || 'Display name';
    $('sheet-hostname').textContent = state.host.hostname
      ? `hostname · ${state.host.hostname}`
      : '';
  }
}

/**
 * How much detail a chat draws. Host-owned, so it arrives on hello and again
 * whenever anyone (this browser, another, or Telegram) changes it; a change
 * re-draws the transcript rather than waiting for the next turn.
 */
function applySettings(settings, { rerender = false } = {}) {
  const level = settings?.verbosity;
  if (!level || level === state.verbosity) {
    paintVerbosityControls();
    return;
  }
  state.verbosity = level;
  paintVerbosityControls();
  if (rerender && state.sessionId) rerenderTranscript();
}

function paintVerbosityControls() {
  for (const b of document.querySelectorAll('#verbosity-seg button')) {
    b.setAttribute('aria-pressed', String(b.dataset.verbosityChoice === state.verbosity));
  }
}

/**
 * Draw the transcript again from what is already in memory, so a detail change
 * is immediate. Terminal panes and the browser are host-owned and untouched.
 */
function rerenderTranscript() {
  if (!els.transcript) return;
  els.transcript.innerHTML = '';
  state.toolCards.clear();
  state.bundle = null;
  state.permCards.clear();
  state.askCards.clear();
  state.stream = null;
  state.streamKind = null;
  state.streamBody = null;
  state.thinking = null;
  state.quietThinking = null;
  state.statusEl = null;
  state.turn = null;
  stopTurnClock();
  state.replaying = true;
  paintTranscriptParts(
    state.liveHead.slice(),
    state.liveHead.length ? state.liveEarlier : 0,
    state.liveRecords.slice(),
  );
  state.replaying = false;
  if (state.busy && state.turn) paintLiveStatus();
  decorate(els.transcript);
  scrollDown(true);
}

/**
 * iOS never fires beforeinstallprompt — Share → Add to Home Screen is the
 * whole path. Android Chrome does, so that one gets a real button. Already
 * running as the installed app hides the block.
 */
let installPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function paintInstall() {
  const block = $('install-block');
  const row = $('install-row');
  const note = $('install-note');
  if (!block || !row || !note) return;
  if (isStandalone()) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  if (isIos()) {
    row.hidden = true;
    note.textContent =
      'On iPhone: tap Share, then Add to Home Screen. Auto opens as its own app, not a Safari tab.';
    return;
  }
  row.hidden = !installPrompt;
  note.textContent = installPrompt
    ? 'Install Auto so it sits on the Home Screen and opens without browser chrome.'
    : 'Use the browser menu → Install app (or Add to Home Screen). Auto then opens without browser chrome.';
}

compact.addEventListener('change', placeControls);
placeControls();
applyTheme();
paintInstall();

$('sheet-open').onclick = () => {
  setRail(false);
  setSheet(true);
};
$('sheet-close').onclick = () => setSheet(false);
els.sheet.onclick = (e) => {
  if (e.target === els.sheet) setSheet(false);
};

$('rename-save').onclick = () => {
  const title = $('rename').value.trim();
  if (!title || !state.sessionId) return;
  sendOp({ op: 'session.rename', sessionId: state.sessionId, title });
  els.title.textContent = title;
  setSheet(false);
};

$('host-nick-save').onclick = () => {
  const nick = $('host-nick').value.trim();
  sendOp({ op: 'host.setNick', nick });
  // Optimistic: the broadcast confirms; empty nick falls back to hostname.
  applyHost({
    hostname: state.host.hostname,
    nick: nick || null,
    label: nick || state.host.hostname,
  });
};
$('host-nick').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('host-nick-save').click();
});

$('sheet-sync').onclick = () => sendOp({ op: 'sessions.sync' });

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  paintInstall();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  paintInstall();
});
$('install-app').onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  paintInstall();
};

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Innermost first: the dialogs sit over the sheet, which sits over a
  // tool view, which sits over the rail.
  if (!$('lightbox').hidden) closeLightbox();
  else if (!els.planSheet.hidden) setPlanSheet(false);
  // Escape leaves the list before it leaves the sheet: one step back at a time.
  else if (!els.modelSheet.hidden && els.modelPanel.dataset.page === 'list') {
    setModelPage('settings');
  } else if (!els.modelSheet.hidden) setModelSheet(false);
  else if (!els.usageSheet.hidden) setUsageSheet(false);
  else if (!$('newbie').hidden) setNewbie(false);
  else if (!els.sheet.hidden) setSheet(false);
  else if (workspaceIsOpen()) showChat();
  else if (els.app.classList.contains('rail-open')) setRail(false);
});

els.mode.onchange = () => {
  paintMode();
  sendOp({ op: 'session.mode', sessionId: state.sessionId, modeId: els.mode.value });
};
els.model.onchange = () => {
  els.modelAuto.checked = false;
  paintBuiltinParameters(els.model.value);
  rememberModel(sessionAgent(), els.model.value);
  sendOp({ op: 'session.model', sessionId: state.sessionId, modelId: els.model.value });
};
els.modelAuto.onchange = () => {
  const automatic = els.modelAuto.checked;
  setModelPage('settings');
  paintBuiltinParameters(automatic ? 'default[]' : els.model.value);
  if (automatic) {
    rememberModel(sessionAgent(), 'default[]');
  }
  sendOp({
    op: 'session.auto',
    sessionId: state.sessionId,
    enabled: automatic,
  });
};
els.modelOpen.onclick = () => {
  setModelSheet(true);
};
els.modelClose.onclick = () => setModelSheet(false);
els.modelSheet.onclick = (e) => {
  if (e.target === els.modelSheet) setModelSheet(false);
};
els.modelChoice.onclick = () =>
  setModelPage(els.modelPanel.dataset.page === 'list' ? 'settings' : 'list');
els.modelBack.onclick = () => setModelPage('settings');
els.modelFilter.addEventListener('input', renderModelList);

/*
 * The sheet can be dragged away.
 *
 * A sheet that rises from the bottom edge should be able to leave by the same
 * edge, and the grabber is only there because it says so. The drag is
 * direction-locked: a mostly-vertical pull on the sheet's own surface (not on
 * a control, and not on a list that can scroll up) is taken as the drag, and
 * the veil behind is set from the finger so the chat sharpens as the sheet
 * goes. Letting go past a third of the panel — or with a flick — dismisses it;
 * anything less springs it back.
 */
(() => {
  const sheet = els.modelSheet;
  const panel = els.modelPanel;
  if (!sheet || !panel) return;
  let drag = null;

  const veil = (progress) => {
    sheet.style.setProperty('--veil', String(Math.max(0, Math.min(1, progress))));
  };

  sheet.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, a, input, select, textarea, label')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dy: 0, decided: false, on: false };
  });

  sheet.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.decided = true;
      // A page that can scroll up owns an upward pull; the sheet only takes
      // downward ones, and only when nothing above the finger can still rise.
      const page = e.target.closest('.model-page');
      const canRise = page && page.scrollTop > 0;
      drag.on = dy > Math.abs(dx) && !canRise;
      if (!drag.on) {
        drag = null;
        return;
      }
      try {
        sheet.setPointerCapture(e.pointerId);
      } catch {}
      sheet.dataset.panel = 'drag';
      sheet.dataset.veil = 'drag';
    }
    drag.dy = Math.max(0, dy);
    panel.style.transform = `translateY(${drag.dy}px)`;
    veil(1 - drag.dy / panel.offsetHeight);
  });

  let lastY = 0;
  let lastT = 0;
  let velocity = 0;

  sheet.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.decided = true;
      // A page that can scroll up owns an upward pull; the sheet only takes
      // downward ones, and only when nothing above the finger can still rise.
      const page = e.target.closest('.model-page');
      const canRise = page && page.scrollTop > 0;
      drag.on = dy > Math.abs(dx) && !canRise;
      if (!drag.on) {
        drag = null;
        return;
      }
      try {
        sheet.setPointerCapture(e.pointerId);
      } catch {}
      sheet.dataset.panel = 'drag';
      sheet.dataset.veil = 'drag';
      lastY = e.clientY;
      lastT = e.timeStamp;
      velocity = 0;
    }
    const now = e.timeStamp;
    if (now > lastT) velocity = (e.clientY - lastY) / (now - lastT);
    lastY = e.clientY;
    lastT = now;
    drag.dy = Math.max(0, dy);
    panel.style.transform = `translateY(${drag.dy}px)`;
    veil(1 - drag.dy / panel.offsetHeight);
  });

  const settle = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dy, on } = drag;
    drag = null;
    panel.style.transform = '';
    sheet.style.removeProperty('--veil');
    if (!on) return;
    // Distance is the honest signal; a flick is for the sheet you meant to
    // throw away but only nudged.
    if (dy > panel.offsetHeight / 3 || velocity > 0.5) {
      setModelSheet(false);
    } else {
      sheet.dataset.panel = 'in';
      sheet.dataset.veil = 'in';
    }
  };
  sheet.addEventListener('pointerup', settle);
  sheet.addEventListener('pointercancel', settle);
})();
els.policy.onchange = () =>
  sendOp({ op: 'session.policy', sessionId: state.sessionId, policy: els.policy.value });

els.usage.onclick = () => {
  setUsageSheet(true);
  refreshUsage(true);
};
$('usage-close').onclick = () => setUsageSheet(false);
els.usageSheet.onclick = (e) => {
  if (e.target === els.usageSheet) setUsageSheet(false);
};
$('plan-close').onclick = () => setPlanSheet(false);
els.planSheet.onclick = (e) => {
  if (e.target === els.planSheet) setPlanSheet(false);
};
els.planBuild.onclick = () => {
  if (!state.openPlanCard) return;
  sendPlanBuild(state.openPlanCard, els.planBuildModel);
};
els.planBuildModel.onchange = () => {
  const card = state.openPlanCard;
  const sel = card?.querySelector('.build-model');
  if (sel && [...sel.options].some((o) => o.value === els.planBuildModel.value)) {
    sel.value = els.planBuildModel.value;
  }
};

// Mobile browsers suspend sockets in the background; resync when we come back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state.sessionId) flushDiskSave(state.sessionId);
    return;
  }
  if (state.ws?.readyState !== 1) connect();
  if (state.sessionId) refreshUsage();
  checkWebBuild();
});
$('update-reload')?.addEventListener('click', () => location.reload());
setInterval(checkWebBuild, 5 * 60 * 1000);
window.addEventListener('pagehide', () => {
  if (state.sessionId) flushDiskSave(state.sessionId);
});

paintMode();
syncSend();
paintNewChat();
initWorkspace();
onViewsChange((snap) => {
  rememberViews(state.sessionId, snap);
  syncTopbarHeight();
});
initTerminals(sendOp);
initBrowser(sendOp);
bindOverlayScrollbars();
// Opening a pane from the rail should reveal it — close the drawer first.
for (const id of ['browser-toggle', 'term-toggle']) {
  const btn = $(id);
  if (!btn) continue;
  const prev = btn.onclick;
  btn.onclick = (e) => {
    if (els.app.classList.contains('rail-open')) setRail(false);
    return prev?.call(btn, e);
  };
}

/**
 * Paint any cached transcript before the socket opens, so a reload is not a
 * blank "Loading conversation…" wait for the same words that were just here.
 */
async function boot() {
  const id = rememberedSession();
  if (id) {
    try {
      const cached = await loadCache(id);
      if (cached?.records?.length || cached?.head?.length) {
        state.sessionId = id;
        paintFromCache(cached);
        setHistoryLoading(false);
      }
    } catch {
      /* cache is best-effort */
    }
  }
  connect();
}
boot();

// ------------------------------------------------------------------ usage

function usageLevel(pct) {
  if (pct == null || !Number.isFinite(pct)) return '';
  if (pct >= 85) return 'hot';
  if (pct >= 65) return 'warn';
  return '';
}

function paintUsageDial(session) {
  const btn = els.usage;
  if (!state.sessionId) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  const pct = Number(session?.contextUsagePercent);
  const fill = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  btn.style.setProperty('--usage-pct', String(fill));
  btn.dataset.level = usageLevel(fill);
  const parts = [];
  if (Number.isFinite(pct)) parts.push(`Context ${Math.round(pct)}% full`);
  if (session?.contextTokensUsed != null && session?.contextTokensMax != null) {
    parts.push(`${tokens(session.contextTokensUsed)} / ${tokens(session.contextTokensMax)} tokens`);
  }
  if (session?.costCents != null) parts.push(money(session.costCents / 100));
  btn.title = parts.length ? `${parts.join(' · ')} — tap for usage` : 'Usage — tap for details';
}

function refreshUsage(force = false) {
  if (!state.sessionId) return;
  sendOp({ op: 'usage.get', sessionId: state.sessionId, force: Boolean(force) });
}

function startUsagePoll() {
  if (state.usageTimer) clearInterval(state.usageTimer);
  state.usageTimer = setInterval(() => {
    if (!state.sessionId || document.hidden) return;
    refreshUsage(false);
  }, 20_000);
  state.usageTimer.unref?.();
}

function setUsageSheet(open) {
  els.usageSheet.hidden = !open;
  if (open) {
    if (state.usage) renderUsageSheet(state.usage);
    else els.usageBody.innerHTML = '<div class="sheet-note">Loading…</div>';
    els.usageBody.scrollTop = 0;
  }
}

function money(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function tokens(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function whenCycle(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const left = Math.max(0, Math.ceil((ms - Date.now()) / 86_400_000));
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} (${left} day${left === 1 ? '' : 's'} left)`;
}

function meter(kind, label, pct, note) {
  const p = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  return `<div class="usage-meter">
    <div class="usage-meter-head"><span>${esc(label)}</span><span>${Math.round(p)}% used</span></div>
    <div class="usage-bar" style="--pct:${p}"><i></i></div>
    ${note ? `<div class="usage-note">${esc(note)}</div>` : ''}
  </div>`;
}

function renderUsageSheet(msg) {
  const session = msg.session || {};
  const account = msg.account || {};
  const pct = Number(session.contextUsagePercent);
  const fill = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const level = usageLevel(fill);
  const bits = [];
  const used = session.contextTokensUsed;
  const max = session.contextTokensMax;
  const hasTokens = used != null && max != null;
  const tokenLine = hasTokens
    ? `${session.contextAssumed ? '≈ ' : ''}${tokens(used)} / ${tokens(max)} tokens`
    : null;

  bits.push(`<section class="sheet-block"><h2>This chat</h2>`);
  bits.push(`<div class="usage-hero">
    <div class="usage-hero-dial" data-level="${esc(level)}" style="--usage-pct:${fill}"></div>
    <div class="usage-hero-copy">
      <strong>${Number.isFinite(pct) ? `${Math.round(pct)}%` : '—'}</strong>
      <span>${tokenLine || `of context used${session.maxMode ? ' · Max Mode' : ''}`}</span>
      ${
        session.costCents != null
          ? `<span class="usage-hero-cost">Est. ${money(session.costCents / 100)} this chat</span>`
          : ''
      }
    </div>
  </div>`);
  if (hasTokens && session.contextAssumed) {
    bits.push(`<div class="usage-note">Window assumed ${esc(session.context || '200k')} — this model did not store a size.</div>`);
  } else if (hasTokens && session.context) {
    bits.push(`<div class="usage-note">${esc(session.context)} context window${session.maxMode ? ' · Max Mode' : ''}</div>`);
  } else if (session.maxMode) {
    bits.push(`<div class="usage-note">Max Mode — absolute tokens need a named context size.</div>`);
  }
  if (session.model) bits.push(`<div class="usage-note">Model: ${esc(session.model)}</div>`);
  if (session.tokens) {
    bits.push(
      `<div class="usage-note">Recorded tokens: ${tokens(session.tokens.input)} in · ${tokens(session.tokens.output)} out across ${session.tokens.bubbles} message${session.tokens.bubbles === 1 ? '' : 's'}</div>`,
    );
  }
  if (session.note) bits.push(`<div class="usage-note">${esc(session.note)}</div>`);
  if (!Number.isFinite(pct) && !session.note) {
    bits.push(`<div class="usage-note">Cursor has not written a context fill for this chat yet.</div>`);
  }
  bits.push(`</section>`);

  bits.push(`<section class="sheet-block"><h2>Account</h2>`);
  if (account.status !== 'ok') {
    bits.push(`<div class="sheet-note">${esc(account.reason || 'Account usage is unavailable.')}</div>`);
  } else {
    const plan = account.plan || {};
    const buckets = account.buckets || {};
    bits.push(
      `<div class="usage-plan"><strong>${esc(plan.name || 'Plan')}</strong>${plan.price ? ` · ${esc(plan.price)}` : ''}${plan.cycleEnd ? `<br>Resets ${esc(whenCycle(plan.cycleEnd))}` : ''}${account.account?.email ? `<br>${esc(account.account.email)}` : ''}</div>`,
    );
    bits.push(
      meter(
        'cursor',
        buckets.cursorModels?.label || 'Cursor Models',
        buckets.cursorModels?.percent,
        buckets.cursorModels?.note || buckets.cursorModels?.message,
      ),
    );
    bits.push(
      meter(
        'other',
        buckets.otherModels?.label || 'Other Models',
        buckets.otherModels?.percent,
        buckets.otherModels?.note || buckets.otherModels?.message,
      ),
    );
    const included = buckets.included || {};
    bits.push(
      meter(
        'included',
        included.label || 'Included usage',
        included.percent,
        included.message ||
          (included.usedUsd != null
            ? `${money(included.usedUsd)} of ${money(included.limitUsd)} · ${money(included.remainingUsd)} left`
            : null),
      ),
    );
    const od = account.onDemand || {};
    bits.push(`<div class="usage-note">${esc(od.note || '')}${od.enabled && od.limitUsd != null ? ` · ${money(od.usedUsd)} of ${money(od.limitUsd)}` : ''}</div>`);

    if (account.totals) {
      bits.push(
        `<div class="usage-note">This cycle: ${tokens(account.totals.inputTokens)} in · ${tokens(account.totals.outputTokens)} out · ${money(account.totals.costUsd)}</div>`,
      );
    }
    if (account.models?.length) {
      bits.push(`<h2 style="margin-top:14px">By model</h2><ul class="usage-models">`);
      for (const row of account.models.slice(0, 8)) {
        bits.push(
          `<li><span>${esc(row.model)}</span><span class="mono">${money(row.costUsd)} · ${tokens(row.inputTokens + row.outputTokens)}</span></li>`,
        );
      }
      bits.push(`</ul>`);
    }
  }
  bits.push(`</section>`);

  els.usageBody.innerHTML = bits.join('');
}

// ------------------------------------------------------------------ lightbox

const lightbox = {
  scale: 1,
  x: 0,
  y: 0,
  /** @type {{ x: number, y: number } | null} */
  drag: null,
  /** @type {{ dist: number, scale: number } | null} */
  pinch: null,
};

function lightboxEls() {
  return {
    root: $('lightbox'),
    stage: $('lightbox-stage'),
    img: $('lightbox-img'),
    close: $('lightbox-close'),
  };
}

function openLightbox(src) {
  if (!src) return;
  const { root, img, stage } = lightboxEls();
  img.src = src;
  lightbox.scale = 1;
  lightbox.x = 0;
  lightbox.y = 0;
  lightbox.drag = null;
  lightbox.pinch = null;
  paintLightboxTransform();
  root.hidden = false;
  stage.classList.remove('dragging');
}

function closeLightbox() {
  const { root, img, stage } = lightboxEls();
  root.hidden = true;
  img.removeAttribute('src');
  lightbox.drag = null;
  lightbox.pinch = null;
  stage.classList.remove('dragging');
}

function paintLightboxTransform() {
  const { img } = lightboxEls();
  img.style.transform = `translate(${lightbox.x}px, ${lightbox.y}px) scale(${lightbox.scale})`;
}

function zoomLightbox(factor, cx, cy) {
  const { stage, img } = lightboxEls();
  const next = Math.min(5, Math.max(1, lightbox.scale * factor));
  if (next === lightbox.scale) return;
  const rect = stage.getBoundingClientRect();
  const px = (cx ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
  const py = (cy ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
  const ratio = next / lightbox.scale;
  lightbox.x = px - (px - lightbox.x) * ratio;
  lightbox.y = py - (py - lightbox.y) * ratio;
  lightbox.scale = next;
  if (lightbox.scale === 1) {
    lightbox.x = 0;
    lightbox.y = 0;
  }
  paintLightboxTransform();
  img.style.cursor = lightbox.scale > 1 ? 'grab' : 'zoom-in';
}

{
  const { root, stage, close } = lightboxEls();
  close.onclick = (e) => {
    e.stopPropagation();
    closeLightbox();
  };
  root.onclick = (e) => {
    if (e.target === root || e.target === stage) closeLightbox();
  };
  stage.addEventListener(
    'wheel',
    (e) => {
      if (root.hidden) return;
      e.preventDefault();
      zoomLightbox(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    },
    { passive: false },
  );
  stage.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (lightbox.scale > 1) {
      lightbox.scale = 1;
      lightbox.x = 0;
      lightbox.y = 0;
      paintLightboxTransform();
    } else {
      zoomLightbox(2.5, e.clientX, e.clientY);
    }
  });

  const point = (t) => ({ x: t.clientX, y: t.clientY });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  stage.addEventListener(
    'pointerdown',
    (e) => {
      if (root.hidden || e.button) return;
      if (e.target.closest('#lightbox-close')) return;
      stage.setPointerCapture(e.pointerId);
      lightbox.drag = { x: e.clientX - lightbox.x, y: e.clientY - lightbox.y };
      stage.classList.add('dragging');
    },
    { passive: true },
  );
  stage.addEventListener(
    'pointermove',
    (e) => {
      if (!lightbox.drag || lightbox.pinch) return;
      if (lightbox.scale <= 1) return;
      lightbox.x = e.clientX - lightbox.drag.x;
      lightbox.y = e.clientY - lightbox.drag.y;
      paintLightboxTransform();
    },
    { passive: true },
  );
  const endDrag = () => {
    lightbox.drag = null;
    stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener(
    'touchstart',
    (e) => {
      if (root.hidden || e.touches.length !== 2) return;
      lightbox.pinch = {
        dist: dist(point(e.touches[0]), point(e.touches[1])),
        scale: lightbox.scale,
      };
      lightbox.drag = null;
    },
    { passive: true },
  );
  stage.addEventListener(
    'touchmove',
    (e) => {
      if (!lightbox.pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const d = dist(point(e.touches[0]), point(e.touches[1]));
      const mid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      const target = Math.min(5, Math.max(1, lightbox.pinch.scale * (d / lightbox.pinch.dist)));
      const factor = target / lightbox.scale;
      zoomLightbox(factor, mid.x, mid.y);
    },
    { passive: false },
  );
  stage.addEventListener(
    'touchend',
    () => {
      lightbox.pinch = null;
    },
    { passive: true },
  );
}