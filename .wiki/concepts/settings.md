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
generated: { by: agent, at: 2026-09-19T00:00:00Z }
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
| `quiet` | One summary line per turn — what it did and how long — and no per-tool rows |
| `normal` (default) | [Tool lanes](tool-lanes.md): activity lines, `Edited file +N −M`, command cards with their output |
| `verbose` | On the web: everything, plus the tool's structured input, the raw `{output, metadata}` envelope when there is no readable text, and the tools Cursor deliberately hides. On Telegram: the hidden tools too, though command bodies stay on the web |

`quiet` is a summary rather than a filter: reads, edits, and commands are
tallied and drawn once, so a long turn is a few lines, not a wall. Created
Plans, approvals, and questions stay visible at every level — they need an
answer.

"Show all" at `verbose` includes the MCP placeholders and internal bubbles
the IDE omits; `normal` and `quiet` keep them out. That omission is the
IDE's, not a verbosity choice, so it only returns when explicitly asked for.

## The turn clock

While a turn runs its line reads **Working… 12s**, ticking once a second;
when it ends it becomes **Worked for 7m 3s** / **Thought for 1s**, plus the
quiet tally. Telegram shows the same elapsed time on the edited turn
message, and the finished "Worked for…" label.

## Related

- [Web](web.md)
- [Telegram](telegram.md)
- [Tool lanes](tool-lanes.md)
- [Host](host.md)
