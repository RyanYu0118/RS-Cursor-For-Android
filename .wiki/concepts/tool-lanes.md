---
type: Concept
title: Tool lanes
description: How desktop tool bubbles become one Cursor work fold, cards — or stay hidden.
tags: [tools, lanes, ui, mcp]
status: stable
sources:
  - id: tools
    resource: /src/web/desktop-tool-ui.js
    title: Lane table (shared)
  - id: core
    resource: /src/core/desktop-tool-ui.mjs
    title: Node re-export for Telegram
generated: { by: agent, at: 2026-09-26T03:30:00Z }
---

# Tool lanes

Every tool bubble from a [desktop thread](desktop-threads.md) is recorded
in the [transcript](transcripts.md). Projections then classify it the way
Cursor groups steps in the IDE. The table lives in `desktop-tool-ui.js` so
the [web](web.md) and [Telegram](telegram.md) share one copy
(`desktop-tool-ui.mjs` re-exports it for Node).

## Lanes

| Lane | What the phone shows |
| --- | --- |
| `hide` | Nothing — Cursor draws nothing either |
| `group` | Counted inside the one work fold ("explored N files") |
| `fileChange` | A row in that fold: "Edited name" and a +/− count |
| `card` | A shell joins the same fold as "Ran …". A question, Created Plan, or anything else stays its own card |

`create_plan` stays a card. `ask_question` is hidden from the OTHER lane —
the Question card is the real UI. See [approvals](approvals.md). How much of
these lanes a chat draws is the [verbosity setting](settings.md): `quiet`
tallies the turn into one line, `normal` is this table, and `verbose` also
shows the `hide` lane.

While a turn is still going, that line stays present at the front —
"Editing 9 files, explored 14 files, 11 searches, 11 browser actions, ran
19 commands" — with a chevron on the right. Opening it shows the steps.
Under the summary sits a second line for the **current subtask** (the tool
running now, or Thinking / Planning next moves). The text stays muted grey;
a white highlight sweeps across it the way Cursor's IDE does. When the step
changes, that line scrolls up to the new one. When the turn ends the gleam
and the current-step line are cleared — a finished fold must not keep
flashing. **Thinking** and **Planning
next moves** are also rows under that line in the opened fold: one line
until tapped, then the text scrolls. Planning is the gap between steps.
Before any step, the bottom summary itself is Thinking or Planning next
moves.
Browser tools (`browser_*`) count as browser actions and stay in the fold.

Cursor names its tools (`edit_file_v2`, `ripgrep_raw_search`). An ACP agent
such as opencode sends its own names (`edit`, `read`, `bash`) with a
`toolKind` instead, so the kind maps to the same lanes: `edit` / `delete`
become file changes, `read` / `search` / `fetch` fold into the activity
line, and `execute` and everything else stay cards. Without that an
opencode session was one OTHER card per call.

## What a row shows

Reads, searches, edits, and shell commands from one stretch sit in **one**
collapsed line, in Cursor's words: "Edited 3 files, explored 1 file, ran 8
commands", with a single +/− total. Opening it lists the steps Cursor
lists: "Used create-rule" for a skill file, "Ran …" from the command's
description, "Thought 5s" or "Thought briefly" for a thought that happened
between steps, and "Edited name +N". Plain reads stay in the explored
count. A stretch that only explored still says "Explored N files".

A thought before that fold stays above it. "Thought briefly" is under a
second; otherwise the line is "Thought 5s". The duration is
`thinkingDurationMs` on the bubble.

When the turn ends, the web draws Cursor's **N Files Changed** card under
the answer: language, file name, and +/− for each file that turn edited.
The first four show; the rest sit behind "Show N more". Review reveals the
rest. It is the list, not Keep / Undo.

A file change's counts come from the tool input (Cursor) or the finished
call's `metadata.filediff` additions/deletions (ACP). Tapping the row
expands to the diff. The agent's own "Edit applied successfully." text is
dropped: the diff is the point. A zero removal is not shown.

Tool cards never print their structured input or the JSON envelope around
their output. ACP wraps a result as `{ output, metadata }` (and repeats the
text in `metadata.output`); Cursor uses `{ text }` or `stdout`/`stderr`.
`toolOutputText` reads the human text out of either and prints nothing when
there is none, because the braces used to bury the one line worth reading.

## Hidden MCP placeholders

Unnamed MCP placeholders arrive as `mcp--` / `tool`, or as `MCP: tool`
once the halves join. The IDE draws nothing for them; Auto used to show an
OTHER card and must not.

## Diffs

Edit results that carry a patch become `diff` transcript records and render
as diffs on the web. They are not a separate Auto subsystem — they ride the
file-change / tool-update path.

## Related

- [Desktop threads](desktop-threads.md)
- [Web](web.md)
- [Telegram](telegram.md)
- [Approvals](approvals.md)
