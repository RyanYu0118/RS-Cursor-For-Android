/**
 * How Cursor's own chat shows a desktop tool call, so Auto's stream can
 * follow it instead of printing every database bubble as OTHER.
 *
 * The IDE groups reads and searches into a quiet status line ("Explored 22
 * files, 13 searches"), puts edits on a file-change lane, and hides a handful
 * of tools entirely. Auto still records every call; this is only how a
 * projection (web or Telegram) should draw one.
 */

const HIDE = new Set([
  'unspecified',
  'reapply',
  'background_composer_followup',
  'knowledge_base',
  'fetch_pull_request',
  'create_diagram',
  'task',
  'await_task',
  'apply_agent_diff',
  'report_bugfix_results',
  'mcp--',
  'tool',
  // The Question card is the real UI; drawing this as OTHER Ask question is noise.
  'ask_question',
]);

/**
 * Cursor writes an MCP bubble before it knows the server or tool. Those land
 * as `mcp--` / `tool`, or as `MCP: tool` once toolName has joined the halves.
 * The IDE draws nothing for them; Auto used to show an OTHER card.
 */
function isNamelessMcp(key) {
  return Boolean(key) && /(?:^|: )tool$/.test(key);
}

const FILE_CHANGE = {
  edit_file_v2: { label: 'Edit file', short: 'Edited', toolKind: 'edit' },
  edit_file: { label: 'Edit file', short: 'Edited', toolKind: 'edit' },
  delete_file: { label: 'Delete file', short: 'Deleted', toolKind: 'delete' },
};

const GROUP = {
  read_file_v2: { label: 'Read file', short: 'Read', toolKind: 'read' },
  read_file: { label: 'Read file', short: 'Read', toolKind: 'read' },
  ripgrep_raw_search: { label: 'Search', short: 'Search', toolKind: 'search' },
  ripgrep_search: { label: 'Search', short: 'Search', toolKind: 'search' },
  glob_file_search: { label: 'Find files', short: 'Find', toolKind: 'search' },
  file_search: { label: 'Find files', short: 'Find', toolKind: 'search' },
  list_dir_v2: { label: 'List directory', short: 'List', toolKind: 'read' },
  list_dir: { label: 'List directory', short: 'List', toolKind: 'read' },
  read_lints: { label: 'Read lints', short: 'Lints', toolKind: 'read' },
  web_search: { label: 'Search web', short: 'Web', toolKind: 'search' },
  web_fetch: { label: 'Fetch webpage', short: 'Fetch', toolKind: 'fetch' },
  await: { label: 'Await', short: 'Await', toolKind: 'other' },
  get_mcp_tools: { label: 'Get MCP tools', short: 'MCP tools', toolKind: 'other' },
  semantic_search_full: { label: 'Semantic search', short: 'Search', toolKind: 'search' },
  todo_read: { label: 'Read todos', short: 'Todos', toolKind: 'read' },
  fetch_rules: { label: 'Fetch rules', short: 'Rules', toolKind: 'read' },
  read_semsearch_files: { label: 'Read search files', short: 'Read', toolKind: 'read' },
  search_symbols: { label: 'Search symbols', short: 'Symbols', toolKind: 'search' },
  go_to_definition: { label: 'Go to definition', short: 'Definition', toolKind: 'read' },
};

const CARD = {
  run_terminal_command_v2: { label: 'Run command', short: 'Run', toolKind: 'execute' },
  todo_write: { label: 'Update todos', short: 'Todos', toolKind: 'other' },
  task_v2: { label: 'Task', short: 'Task', toolKind: 'other' },
  create_plan: { label: 'Create plan', short: 'Plan', toolKind: 'plan' },
  switch_mode: { label: 'Switch mode', short: 'Mode', toolKind: 'other' },
  generate_image: { label: 'Generate image', short: 'Image', toolKind: 'other' },
  computer_use: { label: 'Computer use', short: 'Computer', toolKind: 'other' },
  mcp_auth: { label: 'Authenticate MCP', short: 'Auth', toolKind: 'other' },
  connect_scm: { label: 'Connect GitHub', short: 'GitHub', toolKind: 'other' },
  read_mcp_resource: { label: 'Read MCP resource', short: 'Resource', toolKind: 'fetch' },
  record_screen: { label: 'Screen recording', short: 'Record', toolKind: 'other' },
};

/**
 * ACP tools arrive with a `kind` but no Cursor title ("read", "edit",
 * "bash"). Mapping the kind to the same lanes Cursor's own titles use means an
 * opencode session groups its reads and turns its edits into file changes,
 * instead of one grey OTHER card per call.
 */
const BY_KIND = {
  edit: { lane: 'fileChange', toolKind: 'edit', label: 'Edit file', short: 'Edited' },
  delete: { lane: 'fileChange', toolKind: 'delete', label: 'Delete file', short: 'Deleted' },
  read: { lane: 'group', toolKind: 'read', label: 'Read file', short: 'Read' },
  search: { lane: 'group', toolKind: 'search', label: 'Search', short: 'Search' },
  fetch: { lane: 'group', toolKind: 'fetch', label: 'Fetch', short: 'Fetch' },
};

const PIPES = /[|;&]|&&|\|\|/;

/** A bare `ls` is grouped in the IDE the way a directory listing is. */
export function isSimpleLs(command) {
  const t = String(command || '').trim();
  if (!t || !/^\s*ls(\s|$)/i.test(t)) return false;
  if (PIPES.test(t) || /\$\(|`/.test(t) || /[><]/.test(t)) return false;
  return true;
}

function keyOf(rec) {
  return String(rec?.title || '').trim().toLowerCase();
}

/** Cursor's browser tools, named `browser_*` or `mcp-cursor-ide-browser-browser_*`. */
export function isBrowserTool(rec = {}) {
  return keyOf(rec).includes('browser');
}

function recOf(item) {
  return item?.rec || item || {};
}

/**
 * Which lane a tool call belongs on.
 *
 * `hide` — Cursor draws nothing.
 * `fileChange` — a path and a +/- count, not a named step.
 * `group` — collapsed with its neighbours into an activity row.
 * `card` — a real card: shells, MCP, todos, questions, plans.
 *
 * ACP titles (`Edit File`, `Read File`) are not in the desktop maps, so they
 * stay cards — they already arrive with a kind and often a diff.
 */
export function classifyTool(rec = {}) {
  const key = keyOf(rec);
  if (isNamelessMcp(key) || HIDE.has(key)) {
    return { lane: 'hide', toolKind: 'other', label: 'tool', short: 'tool' };
  }

  const command = rec.rawInput?.command;
  if (command && isSimpleLs(command)) {
    return { lane: 'group', toolKind: 'execute', label: 'List directory', short: 'List' };
  }
  if (command) {
    return { lane: 'card', toolKind: 'execute', label: command, short: 'Run' };
  }

  if (FILE_CHANGE[key]) return { lane: 'fileChange', ...FILE_CHANGE[key] };
  if (GROUP[key]) return { lane: 'group', ...GROUP[key] };
  if (CARD[key]) return { lane: 'card', ...CARD[key] };
  if (BY_KIND[rec.toolKind]) return { ...BY_KIND[rec.toolKind] };
  if (rec.toolKind === 'plan' || rec.rawInput?.plan) {
    return {
      lane: 'card',
      toolKind: 'plan',
      label: rec.rawInput?.name || 'Create plan',
      short: 'Plan',
    };
  }

  const kind =
    rec.toolKind && rec.toolKind !== 'other' && rec.toolKind !== 'tool' ? rec.toolKind : 'other';
  return {
    lane: 'card',
    toolKind: kind,
    label: rec.title || kind || 'tool',
    short: rec.title || kind || 'tool',
  };
}

/**
 * Where a tool's file is. Cursor names it in the input; ACP edits often carry
 * an empty input and put the path on the diff, or only in the title once the
 * call completes ("src\\web\\style.css").
 */
export function toolPath(rec) {
  const input = rec?.rawInput || {};
  const named =
    input.relativeWorkspacePath ||
    input.targetFile ||
    input.path ||
    input.file_path ||
    input.effectiveUri;
  if (named) return String(named).trim();
  const diff = (rec?.content || []).find((b) => b?.type === 'diff');
  if (diff?.path) return String(diff.path).trim();
  const title = String(rec?.title || '').trim();
  return /[\\/]/.test(title) || /\.\w{1,6}$/.test(title) ? title : '';
}

export function toolBase(path) {
  const s = String(path || '').replace(/\\/g, '/');
  const parts = s.split('/').filter(Boolean);
  return parts.at(-1) || s;
}

const LANG = {
  js: 'JS',
  mjs: 'JS',
  cjs: 'JS',
  ts: 'TS',
  tsx: 'TSX',
  jsx: 'JSX',
  css: 'CSS',
  scss: 'CSS',
  html: 'HTML',
  json: 'JSON',
  md: 'MD',
  mdc: 'MD',
  kt: 'KT',
  svg: 'SVG',
  yml: 'YML',
  yaml: 'YML',
};

/** The short language mark Cursor puts beside a changed file ("JS"). */
export function fileLang(path) {
  const base = toolBase(path);
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  return LANG[ext] || (ext ? ext.slice(0, 4).toUpperCase() : '');
}

export function fileStats(rec) {
  const input = rec?.rawInput || {};
  let added = input.added ?? input.editLinesAdded;
  let removed = input.removed ?? input.editLinesRemoved;
  // ACP agents report the counts on the finished call, in `metadata.filediff`.
  if (added == null && removed == null) {
    const fd = rec?.rawOutput?.metadata?.filediff;
    if (fd && (fd.additions != null || fd.deletions != null)) {
      added = fd.additions;
      removed = fd.deletions;
    }
  }
  if (added == null && removed == null) return null;
  return { added: Number(added) || 0, removed: Number(removed) || 0 };
}

/**
 * The "N Files Changed" list for one turn: one row per file, in the order it
 * was first edited. A later update replaces that call's counts; it does not
 * add them again. Reads are not files changed.
 *
 * @returns {{ path: string, name: string, lang: string, added: number, removed: number }[]}
 */
export function changedFiles(records = []) {
  const latest = new Map();
  for (const rec of records) {
    if (!rec) continue;
    if (rec.kind && rec.kind !== 'tool_call' && rec.kind !== 'tool_update') continue;
    const id = rec.toolCallId || `path:${toolPath(rec)}`;
    if (!id) continue;
    const prev = latest.get(id);
    latest.set(id, {
      title: rec.title || prev?.title,
      toolKind: rec.toolKind || prev?.toolKind,
      rawInput: { ...prev?.rawInput, ...rec.rawInput },
      content: rec.content || prev?.content,
      kind: 'tool_call',
      toolCallId: id,
    });
  }
  const edits = new Map();
  for (const [id, merged] of latest) {
    if (classifyTool(merged).lane !== 'fileChange') continue;
    const path = toolPath(merged);
    if (!path) continue;
    const stats = fileStats(merged);
    edits.set(id, {
      path,
      added: stats?.added || 0,
      removed: stats?.removed || 0,
    });
  }
  latest.clear();
  for (const [id, edit] of edits) latest.set(id, edit);
  const byPath = new Map();
  for (const edit of latest.values()) {
    const key = edit.path.replace(/\\/g, '/').toLowerCase();
    const row = byPath.get(key);
    if (row) {
      row.added += edit.added;
      row.removed += edit.removed;
    } else {
      byPath.set(key, {
        path: edit.path,
        name: toolBase(edit.path),
        lang: fileLang(edit.path),
        added: edit.added,
        removed: edit.removed,
      });
    }
  }
  return [...byPath.values()];
}

/** The +/− a batch of file changes adds up to, or null when none reported. */
function batchStats(batch) {
  let added = 0;
  let removed = 0;
  let saw = false;
  for (const item of batch) {
    const stats = fileStats(recOf(item));
    if (!stats) continue;
    added += stats.added;
    removed += stats.removed;
    saw = true;
  }
  return saw ? { added, removed } : null;
}

/**
 * What a tool printed, as one lot of text — never the JSON envelope around it.
 *
 * ACP wraps a result in `{ output, metadata }` (and repeats the text inside
 * `metadata.output`); Cursor uses `{ text }` or separate `stdout`/`stderr`.
 * Printing the envelope itself buried the one useful line under braces, so an
 * object with nothing readable in it yields nothing at all.
 */
export function toolOutputText(out) {
  if (!out) return '';
  if (typeof out !== 'string' && typeof out !== 'object') return String(out);
  if (typeof out === 'string') return out;

  const meta = out.metadata && typeof out.metadata === 'object' ? out.metadata : {};
  let text = '';
  if (typeof out.text === 'string') text += out.text;
  if (typeof out.stdout === 'string') text += (text ? '\n' : '') + out.stdout;
  if (typeof out.stderr === 'string') text += (text ? '\n' : '') + out.stderr;
  if (!text && typeof out.output === 'string') text += out.output;
  if (!text && typeof meta.output === 'string') text += meta.output;
  if (!text && typeof out.error === 'string') text += out.error;
  if (!text && typeof meta.error === 'string') text += meta.error;
  if (!text && typeof out.message === 'string') text += out.message;

  const exit = out.exitCode ?? meta.exit;
  const ms = out.durationMs ?? meta.durationMs;
  const notes = [];
  if (exit !== undefined && exit !== null) notes.push(`exit ${exit}`);
  if (ms) notes.push(durationText(ms));
  if (!text) return '';
  return notes.length ? `${text}\n[${notes.join(', ')}]` : text;
}

/** Is this Cursor's Created Plan card, not a generic tool bar? */
export function isCreatedPlan(rec = {}) {
  const key = keyOf(rec);
  if (key === 'create_plan' || rec.toolKind === 'plan') return true;
  const input = rec.rawInput || {};
  return Boolean(typeof input.plan === 'string' && (input.name || input.overview));
}

/** Title, overview and markdown as the Created Plan card shows them. */
export function planFields(rec = {}) {
  const input = rec.rawInput || {};
  const markdown = typeof input.plan === 'string' ? input.plan : String(rec.markdown || '');
  const heading = markdown.match(/^#\s+(.+)$/m);
  return {
    name: input.name || heading?.[1]?.trim() || rec.title || 'Plan',
    overview: input.overview || rec.overview || '',
    markdown,
    todos: input.todos || rec.todos || [],
    planId: input.planId || rec.planId || null,
    awaitingBuild: rec.awaitingBuild !== false,
  };
}

/** A read of `skills-cursor/<name>/SKILL.md` is Cursor's "Used <name>" row. */
export function skillName(path) {
  const s = String(path || '').replace(/\\/g, '/');
  const m = s.match(/\/(?:skills-cursor|skills)\/([^/]+)\/SKILL\.md$/i);
  return m ? m[1] : '';
}

/**
 * Cursor's thinking line: "Thought briefly" under a second, otherwise
 * "Thought 5s" (and "Thought 1m 5s" past a minute).
 */
export function thoughtLabel(ms) {
  const n = Number(ms) || 0;
  if (n < 1000) return 'Thought briefly';
  const secs = Math.max(1, Math.round(n / 1000));
  if (secs < 60) return `Thought ${secs}s`;
  const minutes = Math.floor(secs / 60);
  const rest = secs % 60;
  return rest ? `Thought ${minutes}m ${rest}s` : `Thought ${minutes}m`;
}

/**
 * A step worth its own row inside Cursor's one work fold.
 * Reads and searches stay in the "explored" count unless the fold is
 * nothing but exploration.
 */
export function stepShown(rec = {}) {
  const ui = classifyTool(rec);
  if (isBrowserTool(rec)) return true;
  if (ui.lane === 'group' && skillName(toolPath(rec))) return true;
  if (ui.lane === 'fileChange') return true;
  if (ui.toolKind === 'execute' && ui.lane !== 'group') return true;
  return false;
}

export function displayLabel(rec = {}) {
  const ui = classifyTool(rec);
  const input = rec.rawInput || {};
  if (isCreatedPlan(rec)) return planFields(rec).name;
  const skill = ui.lane === 'group' ? skillName(toolPath(rec)) : '';
  if (skill) return `Used ${skill}`;
  if (isBrowserTool(rec)) {
    const raw = String(rec.title || '')
      .replace(/^mcp-cursor-ide-browser-/, '')
      .replace(/^browser_/, '')
      .replace(/_/g, ' ')
      .trim();
    const nice = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'action';
    return `Browser ${nice}`;
  }
  if (input.command && ui.lane !== 'group') {
    const desc = String(input.commandDescription || '').trim();
    const line = desc || String(input.command).replace(/\s+/g, ' ').trim();
    return `Ran ${line}`;
  }
  const base = toolBase(toolPath(rec));
  if (ui.lane === 'fileChange') {
    const verb = ui.toolKind === 'delete' ? 'Deleted' : 'Edited';
    return base ? `${verb} ${base}` : ui.label;
  }
  if (base && (ui.lane === 'group' || ui.toolKind === 'read' || ui.toolKind === 'search')) {
    return `${ui.label} ${base}`;
  }
  if (typeof input.query === 'string' && input.query.trim()) return input.query.trim();
  return ui.label || rec.title || rec.toolKind || 'tool';
}

/**
 * Cursor's live subtask under the work summary — present-tense action from
 * `tool-action-labels.js` plus the same details the IDE puts beside it
 * (commandDescription, basename, pattern). Not the past-tense fold labels.
 */
const LIVE_ACTION = {
  run_terminal_command_v2: 'Running',
  run_terminal_cmd: 'Running',
  shell: 'Running',
  read_file_v2: 'Reading',
  read_file: 'Reading',
  ripgrep_raw_search: 'Grepping',
  ripgrep_search: 'Grepping',
  glob_file_search: 'Searching files',
  file_search: 'Searching files',
  edit_file_v2: 'Editing',
  edit_file: 'Editing',
  delete_file: 'Deleting',
  list_dir_v2: 'Listing',
  list_dir: 'Listing',
  read_lints: 'Reading lints',
  web_search: 'Searching web',
  web_fetch: 'Fetching page',
  semantic_search_full: 'Searching',
  create_plan: 'Writing plan',
  await: 'Waiting',
  todo_write: 'Updating todos',
  todo_read: 'Reading todos',
  task_v2: 'Working on task',
  generate_image: 'Generating image',
  switch_mode: 'Switching mode',
  computer_use: 'Using computer',
  record_screen: 'Recording screen',
  mcp_auth: 'Authenticating MCP server',
  connect_scm: 'Connecting GitHub',
  read_mcp_resource: 'Reading resource',
  get_mcp_tools: 'Exploring tools',
};

function liveActionFor(rec, ui) {
  const key = keyOf(rec);
  if (LIVE_ACTION[key]) return LIVE_ACTION[key];
  if (isBrowserTool(rec)) return 'Running';
  if (ui.toolKind === 'execute') return 'Running';
  if (ui.toolKind === 'delete') return 'Deleting';
  if (ui.toolKind === 'edit') return 'Editing';
  if (ui.toolKind === 'read') return 'Reading';
  if (ui.toolKind === 'search') return key.includes('grep') ? 'Grepping' : 'Searching';
  if (ui.toolKind === 'fetch') return 'Fetching';
  if (ui.toolKind === 'plan') return 'Writing plan';
  return ui.short || ui.label || 'Running';
}

function liveDetailsFor(rec, ui) {
  const input = rec.rawInput || {};
  if (input.command && ui.lane !== 'group' && ui.toolKind === 'execute') {
    const desc = String(input.commandDescription || '').trim();
    if (desc) return desc;
    const cmd = String(input.command).replace(/\s+/g, ' ').trim();
    return cmd || 'command';
  }
  if (ui.toolKind === 'search' || /grep|search|glob|find/.test(keyOf(rec))) {
    const pattern = String(input.pattern || input.query || input.glob || '').trim();
    const where = toolBase(toolPath(rec));
    if (pattern && where) return `${pattern} in ${where}`;
    if (pattern) return pattern;
    if (where) return where;
  }
  if (typeof input.searchTerm === 'string' && input.searchTerm.trim()) {
    return input.searchTerm.trim();
  }
  if (typeof input.url === 'string' && input.url.trim()) return input.url.trim();
  const base = toolBase(toolPath(rec));
  if (base) return base;
  if (typeof input.query === 'string' && input.query.trim()) return input.query.trim();
  if (isBrowserTool(rec)) {
    const raw = String(rec.title || '')
      .replace(/^mcp-cursor-ide-browser-/, '')
      .replace(/^browser_/, '')
      .replace(/_/g, ' ')
      .trim();
    return raw || '';
  }
  return '';
}

/** One line matching Cursor's live tool status: "Reading app.js", "Running …". */
export function liveStepLabel(rec = {}) {
  const ui = classifyTool(rec);
  if (isCreatedPlan(rec)) return planFields(rec).name;
  const skill = ui.lane === 'group' ? skillName(toolPath(rec)) : '';
  if (skill) return `Using ${skill}`;
  const action = liveActionFor(rec, ui);
  const details = liveDetailsFor(rec, ui);
  if (details) return `${action} ${details}`;
  return action;
}

const RANK = { in_progress: 4, pending: 4, failed: 3, cancelled: 2, completed: 1 };

function mergeStatus(a, b) {
  return (RANK[b] || 0) > (RANK[a] || 0) ? b : a;
}

function word(n, one, many = `${one}s`) {
  return n === 1 ? one : many;
}

function lineOf(...bits) {
  const parts = bits.map((b) => (typeof b === 'number' ? { n: b } : { t: b }));
  return { parts, label: bits.join('') };
}

/**
 * Cursor's activity copy: muted verbs, bright counts.
 *
 * A turn in flight is present ("Exploring 1 search"); a finished one is past
 * ("Searched 3 files", "Explored 22 files, 13 searches"). The counts are
 * separate from the words so a renderer can draw them louder.
 */
export function activityCopy({ files = 0, searches = 0, running = false } = {}) {
  const fileWord = word(files, 'file');
  const searchWord = word(searches, 'search', 'searches');
  if (running) {
    if (files && searches) {
      return lineOf('Exploring ', files, ` ${fileWord}, `, searches, ` ${searchWord}`);
    }
    if (searches) return lineOf('Exploring ', searches, ` ${searchWord}`);
    if (files) return lineOf('Exploring ', files, ` ${fileWord}`);
    return lineOf('Exploring');
  }
  if (files && searches) {
    return lineOf('Explored ', files, ` ${fileWord}, `, searches, ` ${searchWord}`);
  }
  if (searches) return lineOf('Searched ', searches, ` ${fileWord}`);
  if (files) return lineOf('Explored ', files, ` ${fileWord}`);
  return lineOf('Explored');
}

export function editCopy(count, oneLabel) {
  if (count === 1 && oneLabel) return lineOf(oneLabel);
  return lineOf('Edited ', count, ` ${word(count, 'file')}`);
}

function tallyWork(items = []) {
  let files = 0;
  let searches = 0;
  let edits = 0;
  let commands = 0;
  let browsers = 0;
  let running = false;
  for (const item of items) {
    const rec = recOf(item);
    const ui = item.ui || classifyTool(rec);
    const status = item.status || rec.status || 'completed';
    if (status === 'in_progress' || status === 'pending') running = true;
    if (ui.lane === 'fileChange') edits += 1;
    else if (isBrowserTool(rec)) browsers += 1;
    else if (ui.toolKind === 'search') searches += 1;
    else if (ui.toolKind === 'execute' && ui.lane !== 'group') commands += 1;
    else files += 1;
  }
  return { files, searches, edits, commands, browsers, running };
}

/**
 * One Cursor work fold: "Edited 3 files, explored 1 file, ran 8 commands".
 * A turn still going leads with a present verb ("Editing 9 files, explored
 * 14 files, 11 searches, 11 browser actions, ran 19 commands"). Exploration
 * on its own keeps the older activity line.
 */
export function workCopy(items = [], { live = false } = {}) {
  const tally = tallyWork(items);
  const { files, searches, edits, commands, browsers } = tally;
  const running = live || tally.running;
  if (!edits && !commands && !browsers) return activityCopy({ files, searches, running });
  const clauses = [];
  if (edits) clauses.push([running ? 'editing ' : 'edited ', edits, ` ${word(edits, 'file')}`]);
  if (files || searches || browsers) {
    const bits = [];
    const explorePresent = running && !edits && (files || searches);
    if (files || searches) bits.push(explorePresent ? 'exploring ' : 'explored ');
    if (files) bits.push(files, ` ${word(files, 'file')}`);
    if (files && (searches || browsers)) bits.push(', ');
    if (searches) bits.push(searches, ` ${word(searches, 'search', 'searches')}`);
    if (searches && browsers) bits.push(', ');
    if (browsers) bits.push(browsers, ` ${word(browsers, 'browser action')}`);
    clauses.push(bits);
  }
  if (commands) {
    const cmdPresent = running && !edits && !files && !searches && !browsers;
    clauses.push([cmdPresent ? 'running ' : 'ran ', commands, ` ${word(commands, 'command')}`]);
  }
  const bits = [];
  clauses.forEach((clause, i) => {
    if (i) bits.push(', ');
    if (i === 0 && typeof clause[0] === 'string') {
      const [head, ...rest] = clause;
      bits.push(head.charAt(0).toUpperCase() + head.slice(1), ...rest);
    } else bits.push(...clause);
  });
  return lineOf(...bits);
}

/**
 * Sum +/− for file edits in the current turn (after the last user message /
 * turn_start). Prefer Cursor's editLinesAdded/Removed on each edit tool.
 * Dedupes by toolCallId so a tool_update does not double-count.
 *
 * @returns {{ added: number, removed: number } | null}
 */
export function editStatsForTurn(records = []) {
  let added = 0;
  let removed = 0;
  let saw = false;
  const counted = new Set();
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const rec = records[i];
    if (!rec) continue;
    if (rec.kind === 'turn_start' || rec.kind === 'user_message') break;
    if (rec.kind !== 'tool_call' && rec.kind !== 'tool_update') continue;
    const key = rec.toolCallId || `seq:${rec.seq}`;
    if (counted.has(key)) continue;
    counted.add(key);
    const stats = fileStats(rec);
    if (!stats) continue;
    added += stats.added;
    removed += stats.removed;
    saw = true;
  }
  return saw ? { added, removed } : null;
}

/**
 * How long a spell of work lasted, as a clock: "07:03", or "01:07:03" once it
 * runs past an hour. A bare count of seconds reads as noise across a long turn;
 * minutes and seconds spelled out the way a stopwatch does read at a glance.
 */
export function durationText(ms) {
  const total = Math.max(1, Math.round(Number(ms) / 1000) || 1);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * The line Cursor puts above a finished answer: "Worked for 07:03" when
 * anything was run, "Thought for 00:01" when the turn was only thinking.
 */
export function turnCopy({ durationMs = 0, worked = false } = {}) {
  if (!(durationMs > 0)) return lineOf('Done');
  return lineOf(worked ? 'Worked for ' : 'Thought for ', durationText(durationMs));
}

/** How many reads vs searches sit in a group of tool calls. */
export function groupTally(items = []) {
  let files = 0;
  let searches = 0;
  for (const item of items) {
    const rec = recOf(item);
    const ui = item.ui || classifyTool(rec);
    if (ui.toolKind === 'search') searches += 1;
    else files += 1;
  }
  return { files, searches };
}

function batchStatus(batch) {
  let status = 'completed';
  let failure = null;
  for (const item of batch) {
    const rec = recOf(item);
    status = mergeStatus(status, item.status || rec.status || 'completed');
    failure = item.failure || failure;
  }
  return { status, failure };
}

function isWorkRec(rec) {
  const ui = classifyTool(rec);
  if (ui.lane === 'hide') return false;
  if (isBrowserTool(rec)) return true;
  if (ui.lane === 'fileChange' || ui.lane === 'group') return true;
  return ui.toolKind === 'execute';
}

function workSummary(batch) {
  const { status, failure } = batchStatus(batch);
  const steps = [];
  for (const item of batch) {
    const rec = recOf(item);
    if (!stepShown(rec)) continue;
    steps.push(item.label || displayLabel(rec));
  }
  return {
    ...workCopy(batch),
    status,
    failure,
    lane: 'work',
    count: batch.length,
    stats: batchStats(batch),
    steps,
  };
}

/**
 * Collapse a turn's tool list the way the IDE does, so a phone is not sent
 * sixty "read_file_v2" lines.
 *
 * Items may be records or `{ rec, status, failure }` wrappers.
 */
export function foldTools(tools = [], { includeHidden = false } = {}) {
  const out = [];
  let i = 0;
  while (i < tools.length) {
    const rec = recOf(tools[i]);
    const ui = classifyTool(rec);
    if (ui.lane === 'hide') {
      // Verbose asks for what Cursor hides; keep it as an ordinary card.
      if (includeHidden) {
        const item = tools[i];
        out.push({
          label: item.label || displayLabel(rec),
          status: item.status || rec.status || 'completed',
          failure: item.failure || null,
          lane: 'card',
          count: 1,
        });
      }
      i += 1;
      continue;
    }
    if (isWorkRec(rec)) {
      const batch = [];
      while (i < tools.length) {
        const next = recOf(tools[i]);
        const nextUi = classifyTool(next);
        if (nextUi.lane === 'hide') {
          i += 1;
          continue;
        }
        if (!isWorkRec(next)) break;
        batch.push(tools[i]);
        i += 1;
      }
      if (batch.length) out.push(workSummary(batch));
      continue;
    }
    const item = tools[i];
    out.push({
      label: item.label || displayLabel(rec),
      status: item.status || rec.status || 'completed',
      failure: item.failure || null,
      lane: 'card',
      count: 1,
    });
    i += 1;
  }
  return out;
}
