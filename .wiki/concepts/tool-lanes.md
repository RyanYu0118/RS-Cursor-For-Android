---
type: Concept
title: Tool lanes
description: How desktop tool bubbles become activity lines, file-change rows, cards — or stay hidden.
tags: [tools, lanes, ui, mcp]
status: stable
sources:
  - id: tools
    resource: /src/web/desktop-tool-ui.js
    title: Lane table (shared)
  - id: core
    resource: /src/core/desktop-tool-ui.mjs
    title: Node re-export for Telegram
generated: { by: agent, at: 2026-09-19T00:00:00Z }
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
| `group` | Folded into a quiet activity line ("N files, M searches") |
| `fileChange` | A path and a +/- count on the file-change row |
| `card` | A named step: command, question, Created Plan, other |

`create_plan` stays a card. `ask_question` is hidden from the OTHER lane —
the Question card is the real UI. See [approvals](approvals.md). How much of
these lanes a chat draws is the [verbosity setting](settings.md): `quiet`
tallies the turn into one line, `normal` is this table, and `verbose` also
shows the `hide` lane.

Cursor names its tools (`edit_file_v2`, `ripgrep_raw_search`). An ACP agent
such as opencode sends its own names (`edit`, `read`, `bash`) with a
`toolKind` instead, so the kind maps to the same lanes: `edit` / `delete`
become file changes, `read` / `search` / `fetch` fold into the activity
line, and `execute` and everything else stay cards. Without that an
opencode session was one OTHER card per call.

## What a row shows

A file change is a collapsed line **"Edited <name> +N −M"** — the counts
come from the tool input (Cursor) or the finished call's
`metadata.filediff` additions/deletions (ACP). Tapping it expands to the
diff. The agent's own "Edit applied successfully." text is dropped: the
diff is the point.

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
