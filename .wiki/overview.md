---
type: Overview
title: Auto
description: Remote control for coding agents — Cursor's and opencode — one host, a web app, and a Telegram bot.
tags: [auto, overview]
status: stable
sources:
  - id: agents
    resource: /AGENTS.md
    title: Agent instructions
  - id: readme
    resource: /README.md
    title: README
  - id: host
    resource: /src/server/index.mjs
    title: Host process
  - id: resolve
    resource: /src/acp/resolve.mjs
    title: Agent registry
generated: { by: agent, at: 2026-09-26T09:20:00Z }
---

# Auto

Auto is an always-on remote control for coding agents. One process
(`src/server/index.mjs` on port 4331) serves a web app and a Telegram bot,
and drives conversations that live either in the Cursor desktop app, in a
`cursor-agent acp` child, or in an `opencode acp` child.

A session records which agent it drives ([agents](concepts/acp.md#agents)).
New sessions default to `AUTO_AGENT` (`cursor` unless configured); the web's
New session sheet and Telegram's `/new` choose per session when more than one
agent is installed. Cursor sessions still prefer a chat in the IDE; opencode
sessions are Auto-only, because opencode has no window for Auto to drive.

The host owns state. The web and Telegram are projections: anything one can
do, the other should be able to do. The [transcript](concepts/transcripts.md)
is the truth; clients replay from a sequence number.

## Kinds of session

- **Desktop** — a chat in Cursor's own window. A text message for a chat that
  is not on screen goes through the [desktop bridge](concepts/desktop-bridge.md)
  and does not switch the desktop to it. Typing over the debug port is for the
  chat already in front, for pictures, and when the bridge refuses; then an
  outbox. Replies are read from the desktop database
  ([threads](concepts/desktop-threads.md)). See
  [desktop chats](concepts/desktop-chats.md) and
  [the Cursor window](concepts/cursor-window.md).
- **ACP** — an `cursor-agent acp` or `opencode acp` subprocess, resumable via
  `session/load`. Used when a desktop chat cannot be started, and always for
  opencode. See [ACP](concepts/acp.md).

New sessions prefer the IDE. If no window has the folder, Auto opens one; if
Cursor is not running, it starts it with `--remote-debugging-port=9222`. If
Cursor is already running *without* that port, Auto refuses to quit it by
default (that would close every window) and falls back to ACP unless
`AUTO_ALLOW_CURSOR_RESTART=1`.

## Surfaces

| Surface | Role |
| --- | --- |
| [Host](concepts/host.md) | HTTP, WebSocket, session API, restart |
| [Supervise](concepts/supervise.md) | Keep the host alive across crash and reboot |
| [Web](concepts/web.md) | PWA that caches and replays the transcript |
| [Android shell](concepts/android-shell.md) | Thin WebView APK with a native image picker |
| [Telegram](concepts/telegram.md) | Prompt, watch, approve, switch, restart |
| [Browser](concepts/browser.md) | Real Chrome on this machine, live frames in the client's color scheme |
| [Terminals](concepts/terminals.md) | PTYs for you and (when ACP uses them) the agent |

## Standing rules

- [Access](concepts/access.md) is Tailscale; Auto has no login of its own.
  First clone: [docs/install.md](../docs/install.md). `npm run supervise`
  runs the setup checklist and prints the Tailscale URL.
- One Telegram poller. A second host with the bot token splits messages.
  Develop with `npm run dev` (port 4340, Telegram off).
- Never host Auto in a Cursor agent background shell — those get killed.
  Use [supervise](concepts/supervise.md).
- Skills, docs, and this wiki need no host restart. Anything under `src/`
  does: `POST /api/restart`, Telegram `/restart`, or the web ♻.
- On iOS, Safari owns the keyboard's Previous / Next / Done accessory bar.
  The [web PWA](concepts/web.md#ios-keyboard-chrome) cannot hide it; that
  requires a native wrapper.
- Agent-requested Agent ↔ Plan transitions remain Cursor approvals. Auto
  relays their Switch / Stay choices to web and Telegram and presses the
  selected action in the owning chat.
- Agent choice is per session and persisted. `AUTO_AGENT` sets the default;
  the New session sheet and `/new` override it. A session cannot change
  agents, because that would be a different conversation. Model and mode
  pickers are per agent: Cursor's list and opencode's never share a catalog.
- The phone and the computer share a chat's model. The phone writes it
  through Cursor's model service, and a send waits until the loaded chat
  reads back the same model. A change on the computer shows on the phone.
- Unsent words in the chat box are shared too — type or clear on either
  side and the other follows. If the boxes disagree, the side that presses
  send is the message that goes.
- Desktop model controls mirror Cursor on both projections. The web uses one
  dialog / phone bottom sheet with an Auto switch and searchable Model list;
  Telegram uses keyboards. Fast, Context, Reasoning, or Effort appear only
  when that model exposes them. The choices are a snapshot in the web app
  (`src/web/model-parameters.js`), so the sheet does not ask the open window. Known model choices on web and Telegram also show a broad
  **$ / $$ / $$$** relative price band from published model API rates;
  unknown models are never guessed.

## Related

- [Sessions](concepts/sessions.md)
- [Projects](concepts/projects.md)
- [Approvals, questions, plans](concepts/approvals.md)
- [Queue](concepts/queue.md)
- [Tool lanes](concepts/tool-lanes.md)
- [Skills and workflow](concepts/skills.md)
