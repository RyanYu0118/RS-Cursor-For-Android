---
type: Concept
title: Continuing Cursor desktop chats
description: The same Cursor IDE chat on the phone — window in, database out, bridge as fallback.
tags: [desktop, chats]
status: stable
sources:
  - id: chats
    resource: /src/core/desktop-chats.mjs
    title: Listing desktop chats
  - id: sessions
    resource: /src/core/sessions.mjs
    title: Session attach / catch-up
generated: { by: agent, at: 2026-10-06T12:40:00Z }
---

# Continuing Cursor desktop chats

Auto can pick up a chat started in the Cursor desktop app and carry it on
from the phone — the same chat, not a copy. Send from Telegram and the
message appears in the IDE's own thread; reply in the IDE and it appears on
the phone. This leans on Cursor's internals rather than any published
interface, and that can change under us.

## Starting a chat from Auto

A session started from the web, the pad or Telegram becomes a new chat in
Cursor **without anything moving on the computer**. Starting it only makes
an Auto session (`preferWindow`); no window is opened or launched and no New
Agent button is pressed. Cursor creates an agent only together with its first
message, so the first prompt calls `CursorCdp.createAgentInBackground`: in the
Agents window, `agentRepositoryService.createAgent(text, { type: 'existing',
environment }, { skipFocusAfterSubmission: true, unifiedMode: 'agent' })` —
the same call its composer makes on send. Internally that is
`createComposer({ skipSelect: true })`, so the chat on screen stays the chat
on screen. The new id comes back, the session turns `desktop`, the message is
recorded once (its desktop echo is expected) and the watcher follows the turn.

The folder's workspace identity (`{ id, uri }`) is borrowed from a local agent
already in that folder, else from a workspace the window has loaded — Cursor
derives that id itself. A folder with neither answers `no-workspace`; with no
debug port the call fails. Either way the turn runs on [ACP](acp.md) with one
notice, and the next message tries the background again. Pictures cannot go
with the first message (there is no window to paste into); a notice says so.
The new chat is born on the model picked on the phone (Auto-select unless
one was chosen): `createAgent` is given that `modelConfig`, so the first turn
already runs on it. Until the first message there is no Cursor chat and the
ACP agent refuses `session/set_model` on an untouched session ("Internal
error"), so a model or Fast / Effort chosen in that window is only stored on
the Auto session — nothing is spawned for it. A session
adopted from the CLI is left on ACP. A desktop chat whose window is missing
is opened before a message is held — that path is for existing chats only.

Desktop is the default path, so attaching does not announce that the chat
lives in Cursor. A catch-up that leaves older history out still notes how
many recent messages are shown.

The phone and the computer share the model on a desktop thread. Changing it on either side updates the other. A send waits until the loaded chat is on that model. When Cursor has no debug port the model can be neither read nor written — that is not a mismatch: the message goes through the desktop bridge unchecked, with one notice per session asking for `--remote-debugging-port=9222`. Refusing there once dropped every phone message after a Cursor relaunch without the port, while the bridge was open.

## Into the IDE, and back out

| | Into the IDE | Back out |
| --- | --- | --- |
| Mechanism | Words: [bridge](desktop-bridge.md) when the chat is not the one on screen, so the desktop is not switched to it. The [window](cursor-window.md) when that chat is already in front, when a picture must be pasted, or when the bridge refuses. Then the outbox. | Polling `state.vscdb` — [threads](desktop-threads.md) |
| Code | `cursor-cdp.mjs`, `desktop-bridge.mjs`, `desktop-outbox.mjs` | `desktop-threads.mjs` |

## What the desktop keeps

The name, model, and mode are Cursor's. Stopping is the IDE's button.
Images are not carried on the bridge path (the window paste path is).
Sending needs a window that has the thread; otherwise `unknown-thread`.

`session/list` over ACP and `agent --resume <id>` do not see desktop chats.
Copying a conversation into an ACP session branched it; that path is gone.

How tools are drawn on the phone follows [tool lanes](tool-lanes.md).

## Related

- [Cursor window](cursor-window.md)
- [Desktop bridge](desktop-bridge.md)
- [Desktop threads](desktop-threads.md)
- [Queue](queue.md)
- [Approvals](approvals.md)
