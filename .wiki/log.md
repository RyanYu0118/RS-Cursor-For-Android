# Directory Update Log

## 2026-09-26
* **Update**: Android transcript loads older history on scroll-up via `transcript.more`. See [Android shell](concepts/android-shell.md).
* **Fix**: Android WebSocket ignores stale closes so "重连中" no longer flashes every second. See [Android shell](concepts/android-shell.md).
* **Update**: Cursor desktop approvals are no longer mirrored to clients (queue watch stays); Android Enter sends, Shift+Enter newlines. See [Approvals](concepts/approvals.md) and [Android shell](concepts/android-shell.md).
* **Update**: Android rail mirrors Agents — Pinned / Recent / Repositories, `desktop.continue`, per-folder new session. See [Android shell](concepts/android-shell.md).
* **Update**: Android pad keeps one glass chat window; rail/top bar stay compact; chat prose renders Markdown. See [Android shell](concepts/android-shell.md).
* **Fix**: Desktop Cursor approvals wait for two looks before a phone card, and cancelled asks are removed (not left as flickering "cancelled" rows). See [Approvals](concepts/approvals.md).
* **Update**: Android pad UI uses an immersive light field and liquid-glass panels (rail, top bar, bubbles, composer). See [Android shell](concepts/android-shell.md).
* **Update**: Android pad is native Jetpack Compose (rail, transcript, composer, + / Files / model) with a low-fi skeleton until WebSocket `attached`; WebView kept as 网页版 fallback. See [Android shell](concepts/android-shell.md).
* **Fix**: Android launcher uses the studio `rs-logo.png` with safe-zone padding (no crop under round/squircle masks). See [Android shell](concepts/android-shell.md).
* **Update**: Android thin WebView shell (`android/`) loads Auto's web UI and opens the system image picker via `onShowFileChooser` — Home Screen PWA Files stays unreliable. See [Android shell](concepts/android-shell.md) and [Web](concepts/web.md).
* **Fix**: Files in the + menu uses a full-row opacity-0 file input — a clipped `sr-only` target never opened the OS picker on Android WebView. See [Web](concepts/web.md).
* **Fix**: Files in the + menu keeps the dialog open through the OS picker gesture and nests the file input in the label — closing mid-tap cancelled the chooser on Android. See [Web](concepts/web.md).
* **Update**: Composer **+** MCP opens servers from Cursor's `mcp.json`; desktop-attached pictures sync to the tablet (transcript + unsent composer) via `workspaceStorage` paths and `/api/image`. See [Web](concepts/web.md), [Cursor window](concepts/cursor-window.md), and [Host](concepts/host.md).
* **Fix**: Thought / Ran / Planning are siblings under the work fold — Planning is no longer a parent of the list, and thoughts are not nested under the live status strip. See [Tool lanes](concepts/tool-lanes.md).
* **Fix**: Live subtask text uses Cursor's present-tense labels (Reading / Running / Grepping), not past-tense fold labels. See [Tool lanes](concepts/tool-lanes.md).
* **Fix**: Ending a turn clears the live-subtask gleam so a finished fold does not keep flashing Thinking. See [Tool lanes](concepts/tool-lanes.md).
* **Fix**: Live-subtask gleam keeps a muted grey base and only sweeps a white highlight — it no longer flashes black/white. See [Tool lanes](concepts/tool-lanes.md).
* **Update**: The web queue is Cursor's card — **N Queued**, Start Multitasking, ×, editable body — not a sent bubble or folded summary. See [Queue](concepts/queue.md) and [Web](concepts/web.md).
* **Update**: Live turn shows Cursor's current-subtask line under the work summary, with a white gleam and a scroll-up when the step changes. See [Tool lanes](concepts/tool-lanes.md).
* **Perf**: Chat attach paints only the newest ~60 records (viewport-sized); older history loads when you scroll up or tap the omission notice. See [Web](concepts/web.md).

## 2026-09-25
* **Fix**: Draft sync used Cursor's `getStates()` "focused" row, but that API returns `loadedComposers` — so every chat looked unfocused and phone drafts never reached the computer. Sync now keys off the on-screen `data-composer-id` (same as FACTS). See [Cursor window](concepts/cursor-window.md).
* **Fix**: Draft sync pauses while Cursor is on another chat; each side keeps its text locally and syncs again when that same chat is focused. See [Cursor window](concepts/cursor-window.md).
* **Update**: Composer **+** opens Cursor-style Plan/Debug/Multitask/Ask + Files/Model/MCP; the Agent chip is gone from the pill. The model chip opens Fast/Context/Effort then a nested model list (Auto / Cursor Models / Other Models). See [Web](concepts/web.md).
* **Fix**: Pad composer is a Cursor-style pill: + on the left opens attachments via `label[for=file]` (fixes Android WebView), with model chip, optional voice, and a white send button on the right. See [Web](concepts/web.md).
* **Fix**: Home Screen icons were scaled 1.28× and reused as maskable, so Android cropped the mark. `any` is 1.0 again; maskable PNGs use 0.8 safe padding. See [Web](concepts/web.md).
* **Fix**: Editing either chat box takes push rights immediately; the other side loses them at once, so a computer keystroke is no longer overwritten by the pad a second later. See [Cursor window](concepts/cursor-window.md).
* **Update**: Unsent drafts force-sync every second from the last side that typed, so fast typing cannot leave the boxes apart. See [Cursor window](concepts/cursor-window.md).
* **Fix**: Fast typing no longer leaves the two chat boxes on different text — draft writes are coalesced in order, and a lagging computer echo is ignored while the phone box is being typed into. See [Cursor window](concepts/cursor-window.md).
* **Fix**: Clearing the chat box on either side clears the other. If the two drafts disagree, the message is whatever the side that pressed send had written. See [Cursor window](concepts/cursor-window.md) and [Web](concepts/web.md).
* **Update**: Unsent words in the chat box are shared between the tablet and Cursor. Typing on either side updates the other without focusing the window. See [Cursor window](concepts/cursor-window.md) and [Web](concepts/web.md).
* **Update**: The tablet and the computer share one model. A tablet change is written through Cursor's model-config service, not by opening the menu, and a send waits until that model reads back. A computer change is shown on the tablet. See [Cursor window](concepts/cursor-window.md).
* **Fix**: Passing the tablet's model waited for the whole Cursor turn, timed out, and the message was then typed in on the computer's model. The send now returns once Cursor claims the generation. A submit that does not answer is not typed in again. See [Cursor window](concepts/cursor-window.md).
* **Update**: A model chosen on the tablet is sent as `modelOverride` (Auto is `default`). Cursor's picker and the chat's stored model stay on whatever the computer already had selected. See [Cursor window](concepts/cursor-window.md).
* **Fix**: The tablet showed Auto for a desktop chat that had never stored a model. The send used the chat's own model (whatever the computer had loaded). The tablet now shows that record, and choosing Auto does not press the computer's model button. See [Cursor window](concepts/cursor-window.md).
* **Update**: A text message from the phone goes through the desktop bridge when that chat is not on screen, so Cursor is not switched to it. Typing still brings the chat forward for pictures and when the bridge refuses. Listing the queue no longer brings the chat forward. See [Desktop bridge](concepts/desktop-bridge.md), [Cursor window](concepts/cursor-window.md), and [Queue](concepts/queue.md).
* **Fix**: `AutoSupervise` starts through `scripts/supervise-hidden.vbs`, so the supervisor has no console to close. A direct `node.exe` task was showing a window and dying on Ctrl+C. See [Supervise](concepts/supervise.md).
* **Fix**: The Agents window chat box is `.ui-prompt-input-editor__input`. Auto was treating that window as having no box and holding the phone's message for a bridge that is not running. See [Cursor window](concepts/cursor-window.md).
* **Fix**: A phone session that could not find Cursor (a custom install such as `D:\app\cursor`) no longer stays headless. Auto reads the running `Cursor.exe`, and the next message opens a computer chat and submits there so Cursor calls the model. See [Cursor window](concepts/cursor-window.md) and [Desktop chats](concepts/desktop-chats.md).
* **Update**: The web rail follows Cursor's Agents sidebar: pinned projects, then repositories and their chats with relative times. See [Web](concepts/web.md).
* **Fix**: "No Repo" is no longer a permission card. It is Cursor's empty-workspace mark; only a button that says exactly Yes or No is treated as that answer. See [Approvals](concepts/approvals.md).
* **Fix**: "N Files Changed" hides rows after the first four. `display: flex` was overriding the `hidden` attribute, so "Show N more" sat under a list that was already complete. See [Tool lanes](concepts/tool-lanes.md).

## 2026-09-24
* **Update**: A live turn on the web uses Cursor's summary line ("Editing N files, explored …, N browser actions, ran …") with a chevron, instead of only "Working…". Thinking and Planning next moves sit under it, one line until tapped, then they scroll. See [Tool lanes](concepts/tool-lanes.md).
* **Update**: A finished turn on the web ends with Cursor's "N Files Changed" card (language, name, +/−, Show more). Review only reveals the rest of the list. Keep / Undo stay off the phone. See [Tool lanes](concepts/tool-lanes.md).
* **Update**: The tablet transcript uses Cursor's one work fold: "Edited N files, explored M files, ran K commands", with "Used …", "Ran …", "Thought 5s" / "Thought briefly", and "Edited file +N" inside. Shell rows use `commandDescription`. See [Tool lanes](concepts/tool-lanes.md).
* **Update**: The web rail brand is RS Cursor with the studio mark (`src/web/rs-logo.png`). The tablet app draws edge to edge and pads the header and composer by the status and navigation bars.
* **Update**: The model sheet is a snapshot in `src/web/model-parameters.js`. Choosing Auto, a model, or Fast / Context / Effort no longer presses Cursor's menus or waits on the window. The choice is written onto the chat's `modelConfig`. See [Cursor window](concepts/cursor-window.md).

## 2026-09-20
* **Update**: Turn times are clocks now: `mm:ss` under an hour, `hh:mm:ss` past it — "Working… 00:12", "Worked for 07:03", "Thought for 00:01", tool durations too. `durationBits` (s/m phrasing) became `durationText`, shared by web and Telegram. See [Display settings](concepts/settings.md).
* **Update**: Under `quiet`, every spell of reasoning in a turn folds into a single **Thinking** block, its summary the total time spent thinking — not one block per pause. See [Web](concepts/web.md).
* **Update**: A finished turn always carries a description of what it did. Quiet keeps its tally; at `normal`/`verbose` the tally is added when the turn produced no answer. See [Display settings](concepts/settings.md).

## 2026-09-19
* **Feature**: Typing **`/`** in the web chat box opens a **slash-command list** above it (Verbosity, Mode, Approvals, Model, New session, Stop, Settings, Refresh sessions, Restart Auto). A command with choices opens a second page of options with the current one ticked; arrow keys / tap move, Enter / tap pick, and Escape steps back a page at a time — options, then the list, then the input. See [Web](concepts/web.md).
* **Feature**: A host-owned **verbosity** setting (`state/settings.json`, `src/core/settings.mjs`) with three levels, shared by web and Telegram. Set it from Settings → **Chat detail** (`host.verbosity`) or Telegram `/verbosity` (bare lists the three as buttons); it persists and is broadcast so every client agrees. Quiet tallies a turn into one line, normal is the previous view, verbose restores tool inputs, raw output envelopes, and the tools Cursor hides. See [Display settings](concepts/settings.md).
* **Update**: The live turn line now counts elapsed time — "Working… 12s", ticking once a second — and the quiet turn summary adds what the turn did to the finished "Worked for…" line. Telegram shows the same elapsed time on its edited turn message.
* **Update**: Tool cards no longer print their structured input or the JSON envelope around their output. ACP results (`{ output, metadata }`) and Cursor's `{ text }` / `stdout` / `stderr` are read by `toolOutputText`, which yields the human text or nothing — the braces were burying the one readable line.
* **Update**: Edits now render as a collapsed **"Edited style.css +2 −2"** file-change line that expands to the diff, for ACP agents (opencode) as well as Cursor. ACP tools with a `kind` but no Cursor title map to the same lanes (edit/delete → file change, read/search/fetch → activity line, execute → card), and the counts come from the finished call's `metadata.filediff`.
* **Update**: The web session rail now groups by repo — one accordion per folder holding its chats and sessions. The date headings and the Chats/Projects rows are gone; a row shows only the session title and leads with the driving agent's mark (Cursor's cube or opencode's square) where the status dot used to be, tinted by state. Which repos are open is remembered per folder, and attaching reveals the chat's repo. A **+** on a repo header starts a session in that folder, shown on hover and faint on touch.
* **Feature**: New sessions can start in a folder Cursor has never opened. The New session sheet's **Browse…** reads the machine's drives and directories (`src/core/fs-browse.mjs`, the `fs.list` op, hidden folders and `node_modules` left out) and **Use this folder** fills the path.
* **Update**: The chosen model is remembered per agent in the browser and carried on `session.create`, so a new session opens on it instead of Auto-select; the host applies it before the first prompt and falls back if the agent no longer offers it.
* **Note**: The earlier **opencode** tag in the rail is retired — the per-agent mark in the first bullet above replaces it.
* **Feature**: Auto can remote-control **opencode** as well as Cursor. `src/acp/resolve.mjs` is now an agent registry (`cursor`, `opencode`); `opencode` is located on `PATH` or via `OPENCODE_BIN`, and `AcpClient` spawns whichever agent a session records.
* **Feature**: Sessions started outside Auto are adopted. `syncFromAgent` now asks **both** agents for `session/list` (boot and "Refresh sessions") and registers unseen ones agent-tagged, deduped, and only when the folder still exists; their history is captured from the first `session/load` replay so the phone can read it.
* **Fix**: Resume suppression now lasts until the first prompt. opencode sends part of its replay as notifications after `loadSession` resolves, so clearing the flag at the reply appended history as new records on every restart.
* **Fix**: An agent's `exit` event no longer deletes a runtime a newer process has already replaced (stop-then-start races marked working sessions failed).
* **Update**: Sessions carry an `agent` field. `AUTO_AGENT` sets the new-session default; the web New session sheet and Telegram `/new [agent] [folder]` (plus `/agents`) choose per session, and a session cannot change agents.
* **Update**: opencode sessions are Auto-only — they never open a Cursor chat. They stream thinking, prose, tool calls, and usage over ACP, and approvals/queue/transcripts work unchanged.
* **Update**: Cursor returns `models`/`modes`; opencode returns `configOptions`. `src/acp/config-options.mjs` flattens both to one picker shape and switches via `session/set_config_option` for opencode; catalogs are per agent so one never refills the other's picker.
* **Test**: `npm test` covers the agent registry, config-option normalisation, external-session adoption, and that an opencode session is Auto-only and agent-tagged. Verified live against opencode 1.18.31: prompt, tool call, model/mode switch, and adopt-then-resume across a fresh host.

## 2026-09-09
* **Fix**: Installed iOS topbar/rail now floor `safe-area-inset-top` at 59px (and the same rule is inlined in the shell) — when that env is `0` the title was sitting under the translucent status bar and looking frosted.

## 2026-08-24
* **Fix**: iOS Home Screen status bar is opaque (`black`) instead of `black-translucent` — the chat title and project path were sitting under the system bar's frosted blur, which read as the header gradually going soft (often blue-tinted).
* **Fix**: The model sheet veil no longer uses `backdrop-filter` — blur bled upward onto the topbar (and picked up a blue cast from the chat); a flat scrim dims the chat instead.
* **Fix**: The model sheet now starts below the topbar instead of covering it with a fading blur veil — offsetting the veil alone was not enough on WebKit; the header stays sharp while only the chat softens.
* **Fix**: The model sheet now tracks the visual viewport like New session does, so a short filtered result list stays above the iOS keyboard instead of bottom-anchoring under it.
* **Update**: Browser frames and explicit screenshots emulate the attached web client's `prefers-color-scheme` (dark by default until one attaches), so captures match what that client is showing.
* **Update**: The model list keeps its search box pinned while rows scroll, and drops the under-search `$ / $$ / $$$` legend; exact rates remain on the badge tooltip and accessible label.

## 2026-08-23
* **Fix**: Telegram's ACP and desktop `/model` keyboards append the shared **$ / $$ / $$$** signal to known models, explain `$ lower / $$$ higher`, and leave callback labels, model ids, and unknown-model rows unchanged.
* **Update**: The searchable model list shows amber **$ / $$ / $$$** relative token-price bands from published base input/output rates, with exact-rate tooltip / accessible label; Fast defaults use Fast rates, while unknown future models stay unlabelled rather than guessed.
* **Fix**: Auto-select's own sheet (`selected-auto-menu` — description, Model row, "Auto" as its value) is now crossed by pressing Model like any other sheet; ruling a sheet out because it says "Auto" was why every model looked missing while Auto was on ("Cursor has no model matching …").
* **Fix**: Leaving Auto picks Cursor's own first-listed model — `auto-mode-select` is a choice in the list, not a toggle, so pressing it while Auto was on did nothing and the phone's switch snapped back.
* **Update**: `namedModels` reads the model list without choosing; menu rows are marked `row` so a badge ("Max", "High Fast") is never mistaken for a model.
* **Update**: The web Auto switch moved out of the model sheet and onto the composer beside the mode chip, styled to match it; the model chip hides while Auto is on and the sheet no longer offers Auto.
* **Fix**: Model-sheet parameter rows no longer squeeze their label into an ellipsis — the copy is capped so the control keeps its seat, a description wraps instead of truncating, and a switch stays beside its label where a select with a long description stacks.
* **Fix**: The model sheet's full-screen root no longer owns a backdrop filter — blur lives only on an inert veil below the topbar, with the panel explicitly above it, so WebKit keeps both the app header and model controls sharp.
* **Update**: Composer image attachments doubled to 112px — a 56px chip is a checkbox, not a preview.
* **Update**: The model sheet can be dragged away with a finger — direction-locked, the chat behind deblurs in step with the drag via a `--veil` pseudo-layer, past a third or a flick dismisses, and open/close are the same rise/fall played both ways (close now waits for the fall before hiding).
* **Update**: `![alt](…)` in an answer is a real image on the web — http(s) and `data:` load directly, a host file goes through the new `/api/image` (raster only, no SVG, inside the chat's folder / Cursor's screenshot temp / `state/`, checked by real path), tapping opens the viewer, and a refused file collapses to its alt text. Telegram reads it as "🖼 alt".
* **Fix**: Changing a model's Context (or the model itself) refreshes the composer's context dial — the size is the dial's denominator, and it used to stay wrong until the next 20s poll.
* **Update**: Choosing a model is a page in the sheet, not an inline drawer — the list slides in from the right over the whole dialog and back out when a model is picked; the header grows a back chevron, Escape steps back one level, and the rail's height is measured and eased so the dialog grows into the list.
* **Update**: Model sheet redrawn from the chat box's own parts — composer radius and mode-coloured edge, grouped cards instead of full-bleed hairline rows, chip selects with a drawn chevron, and the scrubber's coloured-edge-plus-ring for the model you are on.
* **Fix**: Sheet switches had no visible track — every rule using `var(--blue)` was invalid at computed-value time because that property is never declared anywhere; they now use `--focus`. `npm test` fails on any undeclared custom property.
* **Fix**: The open model list was clipped out of existence — a `.model-card` in a column flex box shrank below its content while `overflow: hidden` hid the result; cards no longer shrink, and a test holds that.
* **Update**: Removed the web/Telegram Review changes card — Cursor only offers a global Keep/Undo bar, not per-edit rollback, so a bottom-of-chat card was misleading; review in the IDE.
* **Update**: Web composer now has one model summary button; it opens a desktop dialog / phone bottom sheet with Auto, a searchable model list, and clearly labelled live parameters.
* **Update**: Model controls now mirror Cursor: Auto is a separate switch, and web/Telegram discover and select the current model's Fast, Context, Reasoning, or Effort options from the IDE's nested menus.
* **Fix**: Parameter-sheet detection keys on the stable Model row instead of requiring Effort, so GPT's Context/Reasoning sheet reaches the model list too.
* **Fix**: Desktop model switch drills through the compact picker's parameters sheet (Fast / Effort / High / Model) into the real list, then search — GPT 5.5 and Auto-select were missing because Auto was reading that first menu as the whole offer.
* **Fix**: New Agent from the phone hits the real `(Ctrl+N)` workbench button with a CDP mouse click — editor-group chrome that also says "New Agent" no longer fakes success and forces ACP fallback.

## 2026-08-22
* **Update**: Agent-requested Agent ↔ Plan transitions reach web and Telegram as Cursor approval choices; Auto recognizes the observed Switch / Skip labels, strips Switch's inline shortcut hint, and presses the selected action in the owning chat.
* **Documentation**: iOS Previous / Next / Done keyboard bar is native Safari form-assistant chrome; a browser/PWA cannot hide it, and doing so requires a native wrapper.
* **Update**: PWA detects a newer web build (`webBuild` fingerprint) on reconnect and foreground poll, and shows a reload banner when the host has moved on.
* **Fix**: Scrubber scrolls the chat so the active landmark's message sits at the top of the viewport (was ~28% down and only snapped in a narrow rail band).
* **Fix**: Markdown table columns cap at 28em with word wrap — scroll only when wrapped columns still overflow, not `max-content` no-wrap.
* **Fix**: Mermaid bomb errors — fences must start a line (so `` ` ```mermaid ` `` in prose is not a diagram), `$…$` no longer runs inside inline code, and failed parses show source text instead of Mermaid's error SVG.
* **Update**: Web markdown now renders Mermaid diagrams, KaTeX math, and GitHub callouts (`> [!NOTE]` etc.) — `markdown.js` emits containers, `enrich.js` paints them from `/vendor/mermaid.mjs` and `/vendor/katex.mjs`.
* **Fix**: Streaming answers no longer jump the scroll — stick-to-bottom is instant (coalesced), `#transcript` dropped CSS smooth scroll, and live agent bubbles pin min-height so incomplete markdown cannot collapse.
* **Update**: Markdown copy on long agent answers is a quiet right-aligned clipboard icon (check on success), not a text label.
* **Update**: Long agent answers on the web get a **Copy markdown** footer — raw source stays on the bubble (`data-raw` / `.agent-body` split) so streaming does not wipe the button.

## 2026-08-21
* **Fix**: Auto no longer force-quits Cursor when the debug port is missing — refuses and falls back to ACP unless `AUTO_ALLOW_CURSOR_RESTART=1`.
* **Update**: File-review Keep/Undo is a transcript card (+/− headline, scrub landmark), not a sticky composer strip.
* **Fix**: File-review phone buttons require exact short labels (Keep All / Undo All / Redo) — chat titles starting with "Undo" no longer appear as Undo.
* **Update**: Desktop file-review bar (Keep All / Undo All / Redo) is a deliberate action on web and Telegram — never an approval; watcher survives the turn.
* **Update**: Tab favicon crop matches the rail mark (and ICO fills tighter) so the A reads at PC tab size.
* **Update**: Tab favicon (`icon.svg` / `favicon.ico`) is transparent; home-screen PNGs keep the full-bleed dark tile.
* **Update**: New chat focuses the composer immediately (and again once the empty session attaches).
* **Update**: Web scrollbars are thin overlay thumbs — idle-invisible, visible on hover / while scrolling (macOS-style on PC).
* **Update**: Usage sheet omits the chat cost line when Cursor wrote no figure — no more "Est. cost not recorded yet".
* **Update**: Stopping a turn puts the prompt back in Auto's composer (and off the stream) so it can be edited and resent — Cursor's box is still cleared so a phone can reach the chat; Telegram gets the words as a draft.
* **Fix**: Session-rail hamburger — accordion open state survived redraws (teardown `toggle` no longer writes "neither"); swipe click-guard expires so the next open switches chats on the first tap.
* **Update**: Idle scrub grip docks into the right edge as a peek (no fade); scroll or tap slides it out.
* **Fix**: Session-rail accordion scrolls again — overflow is on the list, not a nested `<details>` body that never got a height.
* **Update**: Chats / Projects accordion rows collapse on a second tap (both may be closed); open state still remembered.
* **Update**: Session rail is a Chats / Projects accordion (two rows; exclusive open; remembered) so Projects is not buried under a collapsed details at the bottom of the chat list.
* **Update**: Web composer floats over the transcript — no hairline above the box; messages scroll through a fade underneath, with `--composer-height` clearing the live edge.
* **Update**: Scrub labels move linearly with the finger (even landmark spacing on the wheel), independent of how much chat text sits between landmarks — that uneven mapping was what made the timeline jump.
* **Update**: Reverted scrub labels to the semicircle width wheel; kept the harder chat dim (18%) while scrubbing.
* **Update**: Scrub labels are wider (~260px) and follow the finger continuously; only the chat content snaps to landmarks, so the wheel no longer jitters under the magnetic latch.
* **Update**: Chat text fades slightly while the scrub timeline is open so the landmark pills lead.
* **Fix**: Fast scrubbing no longer lets timeline labels slide past the top/bottom of the pane — pill `top` tracks instantly, off-wheel pills hide hard, and the timeline clips.
* **Fix**: "Loading conversation…" never left the screen — the opening-prompt refactor called `earlierNotice()` without ever defining it, so every replay threw. The function exists now, and `npm test` scans the web client for free calls to functions that exist nowhere (`node --check` accepts them as possible globals, which is how this shipped).
* **Update**: Long-chat replay pins the opening prompt above the newest tail so the first message (and its scrub landmark) stay visible.
* **Update**: Web client caches the transcript tail (memory + IndexedDB) so reload and chat switch paint immediately, then catch up from `lastSeq`.
* **Update**: Active scrub label is brighter (kind-coloured ring, stronger type) and stays opaque near centre.
* **Update**: Scrub mode draws a radial veil behind the label wheel so chat text cannot wash out the pills.
* **Update**: Scrub labels are now a counter-scrolling rotary wheel; widths trace a semicircle and fade to zero at the viewport ends.
* **Update**: Scrub labels sit 32px beyond the grip, use larger text/padding, and widen progressively toward vertical screen centre.
* **Fix**: Scrubber now spans the chat pane, making the label's 92px right clearance real instead of being measured inside a zero-width container.
* **Update**: Scrub plan pills use amber (yellow); labels sit further left so they never touch the grip.
* **Update**: Scrub snap is magnetic (only near a landmark); labels stay clear of the grip, thinner, active = whiter text only.
* **Update**: Scrub handle is a flush right-edge grip (rounded on the left, drag ridges, no arrows).
* **Update**: Scrubbing snaps to landmarks and buzzes (`navigator.vibrate`) on each new snap point.
* **Update**: Scrubber pills size to their labels (readable); density only raises the minimum width.
* **Update**: Chat scrubber is Photos-style — handle while scrolling; labeled density-weighted timeline expands left of the thumb only while scrubbing.
* **Update**: Long chats get a scroll scrubber (ticks for your messages, questions, plans, approvals + a floating preview) that appears while scrolling.

## 2026-08-20
* **Update**: Topbar has New chat (same-repo empty conversation); Browser and Terminals toggles moved to the session-rail foot above Settings.
* **Update**: Desktop attach no longer announces "lives in the Cursor desktop app" — that is the default; truncated catch-up still notes how many messages are shown.
* **Update**: Full-window View Plan keeps Build + model picker in a sticky footer under the plan text.
* **Update**: View Plan opens the plan markdown full-window (× / Escape), not inline in the card.
* **Update**: View Plan on the web keeps the Created Plan card in the chat column — wide fences scroll inside instead of clipping mid-line on a phone; repo-path links render as code.
* **Update**: Icons are three tags — `favicon.ico`, `icon.svg`, `apple-touch-icon.png` — after an attempt to make the iOS share sheet draw the mark full-bleed went nowhere. Ruled out: clean vs fingerprinted icon URLs, a precomposed touch icon, raster favicons in three sizes, `mask-icon`, a fresh MagicDNS origin, and HTTPS on 443. That white matte is Safari's chrome.
* **Update**: Auto is reachable over HTTPS inside the tailnet via `tailscale serve` (443 → 4331); Funnel stays off.
* **Update**: App icon mark scaled up (~1.28×) so it fills more of the home-screen / share preview.
* **Update**: Browser tab title leads with this machine's host label (`hostname · Auto`).
* **Update**: Session-rail WebSocket status is a coloured dot left of the host name (no Connected / Reconnecting… text in the header).

## 2026-08-18
* **Update**: Picking a model whose row bundles two badge words into one span (Grok's "High Fast") now works — either word finds that same press, instead of the row going unmatched and its badge text gluing onto the next row's "New" tag.
* **Update**: Picking a named model from the phone works while Cursor is on Auto — the menu hides every other row until Auto types the name into its search box.
* **Update**: Markdown-only edits skip `npm test`; skill `SKILL.md` and any non-markdown file still run the suite.

## 2026-08-17
* **Update**: Mode/model chips scale as one group (no overlap); still ~75% with a 16px font so iOS Safari does not focus-zoom.
* **Update**: Mode/model chips draw at ~75% size via `transform: scale(0.75)` while keeping a 16px font so iOS Safari does not focus-zoom; Home Screen PWA still uses true 12px.
* **Update**: WebSocket status sits in the session-rail header beside Auto (Connected / Reconnecting…), not under Settings at the foot.
* **Update**: View tabs (Browser / shells / which was selected) are remembered per chat across refresh and session switch.
* **Update**: Browser and each shell open as tabs under the header (Chat first, no × on Chat); the side workspace dock is gone. The strip scrolls sideways when tabs overflow.
* **Update**: Browser and terminal toggles live in the topbar at every width (including phone); Settings no longer has a Panels section for them.
* **Update**: Mode/model chips draw at a true 12px in the installed PWA (maximum-scale=1 makes focus-zoom impossible there; the 16px base stays for Safari tabs), and the mode chip's background takes a tint of the mode colour. The rail's new-session and close buttons are inline SVGs instead of text glyphs.
* **Update**: Transcript loading overlay shows the Auto A mark (breathing) instead of a spinner.
* **Update**: Session rail shows this machine's hostname (or a nick from Settings → Host); stored in `state/host.json`.
* **Update**: iOS Home Screen no longer zooms when tapping mode/model — dropped CSS `zoom` on those chips (WebKit still focus-zoomed the scaled size) and locked `maximum-scale=1` in standalone.
* **Update**: New chats started from Auto land on Auto-select (`default[]` / Cursor's "Auto"), instead of inheriting the last chat's model.
* **Update**: Telegram posts prompts typed on the web or in Cursor (without echoing ones typed in Telegram), and retries a turn whose first send failed.
* **Update**: `npm run supervise` runs the setup checklist, flags a missing `agent login` in red, and prints the Tailscale URL (and local port) in colour once the host is up.
* **Update**: Setup treats `agent status` `Not logged in` as a fail (it used to match `/logged in/` and go green). CLI present but unsigned-in is why the model picker stayed empty.
* **Update**: Usage sheet "Model" is the last-sent id in `composerData` (`default` for Auto-select — Cursor does not store which model it routed to). Account "By model" is cycle-wide billed `modelIntent`, not this turn.
* **Update**: Picking Kimi K3 from the phone no longer fails — agent slugs (`kimi-k3`) match Cursor's menu words (`Kimi K3`), and `reasoning=max` is the Max badge.
* **Update**: iOS Home Screen composer still had a strip under it — 8px padding, shell sized to the visual viewport; css/js URLs are now fingerprinted from file mtime so the installed app redownloads them.
* **Update**: Web app is actually installable on the Home Screen — Apple meta + PNG touch icon, 192/512 manifest icons, SVG favicon, and a Settings hint (Share → Add to Home Screen on iPhone).
* **Update**: First-run tutorial at `docs/install.md` (Tailscale, Cursor CLI, debug port). `npm install` runs `scripts/setup.mjs`. Access/overview depersonalised for a public clone.

## 2026-08-16
* **Update**: Desktop prompt echoes are expected before the Cursor write and re-seeded after restart, so user messages stop appearing two or three times.
* **Update**: Usage sheet shows tokens used / context max and estimated chat cost (summed from Cursor’s `usageData`).
* **Update**: Pasted images sit inside the composer box (above the text), not in a strip above it.
* **Update**: New session sheet on a phone tracks the visual viewport so project filter results stay above the soft keyboard.
* **Lint / expand**: Split overloaded `desktop-chats` into [desktop-bridge](concepts/desktop-bridge.md) and [desktop-threads](concepts/desktop-threads.md); added [access](concepts/access.md), [supervise](concepts/supervise.md), [tool-lanes](concepts/tool-lanes.md). Deepened ACP (shell deviation, error-as-prose), host, transcripts (map table), Telegram (web parity). Refreshed overview and index.

## 2026-08-15
* **Update**: MIT `LICENSE`; README notes unofficial status and license. Settings gear is an inline SVG (Icons8 PNGs removed).
* **Update**: Browser and terminals share one workspace — right dock on a wide screen, full-screen sheet on a phone — instead of stacking strips on the chat column.
* **Update**: Usage sheet meters use the amber fill (same as the context dial), with a slightly clearer plan card and bar layout.
* **Update**: Attached images show as thumbnails in the chat stream and above the composer; tap opens a zoomable lightbox (pinch / wheel / drag).
* **Update**: Composer usage dial (this chat's context fill) plus a sheet for Cursor Models / Other Models / included / on-demand and per-model spend — same numbers as cursor.com, not shown in the IDE chat chrome.
* **Update**: Changing a desktop chat's model keeps the web picker on that model — it used to store Cursor's label as the value and go blank.
* **Update**: Changing a desktop chat's model no longer lets Cursor auto-send the next queued message when the switch ends a paused turn (e.g. high demand) — the queue is held first.
* **Update**: Unnamed MCP placeholders (`MCP: tool`) are hidden like in the IDE, instead of showing as OTHER cards.
* **Update**: A submitted message no longer appears two or three times — the web keeps echo credits for the optimistic bubble, and the host expects Cursor's copy on queued and held sends too.
* **Update**: Mirrored answers no longer stutter — stale shorter DB reads are ignored, and real rewrites replace the bubble instead of appending.
* **Update**: Each web session keeps its own composer draft; idle sends appear in the stream immediately.
* **Update**: Cursor harness notes (`system_notification` when a background command finishes) are not copied onto the phone — they are stored as user bubbles, but the IDE never paints them.
* **Update**: Bare http(s) URLs in the chat are links — on the web and on Telegram.
* **Update**: Swiping the session rail left on iPhone uses touch events, because Safari never fires pointermove on a scrolling list.
* **Update**: On a phone, × archives a session on the first tap, and swiping the session rail left closes it.
* **Update**: The web tab remembers the open chat (`?session=` and the browser) so a refresh or returning to Auto opens the same conversation, not the host's active session.
* **Update**: Settings is a gear + label at the bottom of the session rail, and the panel fills the screen. The top-bar ⋯ is gone.
* **Update**: A host restart mid-turn no longer marks Cursor's finished bubbles as already in the transcript, so the closing answer still reaches the phone.
* **Update**: Composer mode/model chips stay 16px for iOS but `zoom: 0.75` so they look like 12px.
* **Update**: The web composer's attach control is a + on the lower-right. Mode and model are chips (background, rounded edges) at 16px so iOS does not zoom on tap.
* **Update**: Question answers press Cursor's questionnaire toolbar (sibling of the tool bubble). Option text is often glued as "ARed"; Continue is located even while disabled.
* **Update**: Question answers are a real mouse on lettered option rows, not a click for `role=radio` inside the tool bubble — that was "no option says Red".
* **Update**: The web composer's attach control is a binder on the lower-right of the box, not a + in the typing row.
* **Update**: Skip/Continue on an `ask_question` bubble are not approvals. A question with no options yet still keeps the approval watcher off. Option press matches a truncated label and falls back to the Nth row.
* **Update**: A prompt Auto typed into Cursor is matched with normalised quotes and spacing, and a second desktop bubble of the same send is not drawn again.
* **Update**: The web composer colours its ring, send button, and mode word from the mode in force (Agent / Plan / Debug / Multitask / Ask), matching Cursor, and Debug and Multitask are in the picker.
* **Update**: A finished turn now says how long it took (Worked for / Thought for), matching Cursor. The web shows Working… while it runs and no longer leaves commands "running…" after the session goes idle.
* **Creation**: Migrated the knowledge base from `wiki/` + `raw/` (npm llm-wiki CLI) into `.wiki/` (OKF). Seeded overview and concept pages covering the current host, sessions, transcripts, desktop chats, Cursor window, ACP, approvals, queue, Telegram, web, browser, terminals, projects, and skills.
* **Update**: Diagnosed why the wiki had gone stale — the global `llm-wiki` skill had `disable-model-invocation: true` (never auto-applied) and this repo had no `.wiki/` bundle for it to maintain.

## 2026-08-09
* **Creation**: `wiki/concepts/llm-wiki.md` and `wiki/concepts/auto_web.md` via npm `wiki ingest` (retired path).
* **Note**: `wiki/concepts/desktop_chats.md` was later written by hand into the old bundle; content now lives at [desktop-chats](concepts/desktop-chats.md).
