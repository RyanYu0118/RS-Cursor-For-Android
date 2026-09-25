---
type: Concept
title: Display settings
description: Host-owned chat detail (verbosity), persisted and broadcast so web and Telegram agree.
tags: [settings, verbosity, web, telegram]
status: stable
sources:
  - id: settings
    resource: /src/core/settings.mjs
    title: DisplaySettings store
  - id: server
    resource: /src/server/index.mjs
    title: host.verbosity op and settings broadcast
  - id: web
    resource: /src/web/app.js
    title: Web rendering by level
  - id: telegram
    resource: /src/core/telegram.mjs
    title: /verbosity and quiet summary
generated: { by: agent, at: 2026-09-24T15:10:00Z }
---

# Display settings

What a chat shows is a host setting, not a browser preference. `verbosity`
lives in `state/settings.json` (`src/core/settings.mjs`), is returned on the
WebSocket `hello`, and is broadcast as `{type:'settings'}` whenever it
changes — so the web tab, a second browser, and [Telegram](telegram.md)
cannot disagree. A browser's `localStorage` still holds only what is private
to that browser (theme, rail accordions, the remembered model).

Set it from Settings → **Chat detail** on the web (`host.verbosity`), or
from Telegram with `/verbosity` (bare lists the three as buttons). The host
persists the choice, so it survives a restart.

## Levels

| Level | What a chat shows |
| --- | --- |
| `quiet` | One summary line per turn — what it did and how long — and no per-tool rows; every spell of reasoning in the turn folds into a single Thinking block |
| `normal` (default) | [Tool lanes](tool-lanes.md): one work fold ("Edited N files, explored M files, ran K commands"), with Ran / Used / Thought / Edited rows inside |
| `verbose` | On the web: everything, plus the tool's structured input, the raw `{output, metadata}` envelope when there is no readable text, and the tools Cursor deliberately hides. On Telegram: the hidden tools too, though command bodies stay on the web |

`quiet` is a summary rather than a filter: reads, edits, and commands are
tallied and drawn once, so a long turn is a few lines, not a wall. Created
Plans, approvals, and questions stay visible at every level — they need an
answer. Reasoning is likewise one block per turn, not one per spell: how many
times the agent paused is noise on a phone, only that it thought and for how
long matters.

"Show all" at `verbose` includes the MCP placeholders and internal bubbles
the IDE omits; `normal` and `quiet` keep them out. That omission is the
IDE's, not a verbosity choice, so it only returns when explicitly asked for.

## The turn clock

Times are clocks, not prose: `mm:ss` while under an hour (`07:03`, `00:08`),
`hh:mm:ss` past it (`01:07:03`). While a turn runs, the web shows the work
summary (Editing / explored / browser actions / ran), not a lone Working…
clock. When it ends the line becomes **Worked for 07:03** / **Thought for
00:01**. A finished turn always carries
a description of what it did: the quiet tally is appended to the line, and at
`normal`/`verbose` the agent's own answer carries it — the tally is added only
when the turn produced no answer. Telegram shows the same clock on the edited
turn message, and the finished "Worked for…" label.

## Related

- [Web](web.md)
- [Telegram](telegram.md)
- [Tool lanes](tool-lanes.md)
- [Host](host.md)
