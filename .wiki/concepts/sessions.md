---
type: Concept
title: Sessions
description: One Auto session is one conversation — a desktop chat or an ACP child — with its own transcript.
tags: [sessions, lifecycle]
status: stable
sources:
  - id: sessions
    resource: /src/core/sessions.mjs
    title: Session manager
generated: { by: agent, at: 2026-09-25T03:50:00Z }
---

# Sessions

One Auto session is one conversation. Auto's session id is Auto's, not the
agent's: an ACP session can be rotated underneath (after a crash) while the
transcript and everything the user sees carries on.

Idle ACP sessions cost nothing but their history: the process is spawned
lazily and resumed via `session/load`. Desktop sessions have no process of
ours — messages go into Cursor and come back from its database.

## Kinds

| `kind` | `agent` | Where the conversation lives |
| --- | --- | --- |
| `desktop` | `cursor` | A thread in the Cursor app. Model, mode, and approvals are Cursor's. |
| (ACP) | `cursor` | A `cursor-agent acp` child. Auto sets mode/model and brokers permissions. |
| (ACP) | `opencode` | An `opencode acp` child. Auto-only — there is no window to drive. |

Every session records its `agent`; it does not change for the life of the
conversation. `AUTO_AGENT` sets the default for new sessions and the web New
session sheet / Telegram `/new` override it. New Cursor work starts in the IDE
when it can (`startInIde`), falling back to ACP with a
[notice](transcripts.md) saying why. The next prompt retries the IDE; if a
chat opens, the message is typed there. Sessions adopted from the CLI stay
on ACP. opencode sessions skip the IDE entirely.
The model and mode catalogs are per agent (`catalogFor`), so one agent's list
never refills the other's picker.

## Status

`idle`, `busy`, `starting`, `error`, `archived`. Whether a desktop turn is
running comes from the desktop database (`chatGenerationUUID`), not from the
word "Stop" in the window — that word also belongs to the file-review bar.

## Active folder

There is one active session. Its `folder` is where Telegram messages run.
Switching only sticks through the session API (`POST /api/session` with a
folder, or `POST /api/session/active` by id or title). `cd` and a spoken
"now in repo X" revert on the next message.

The [web](web.md) tab remembers its own open chat (`?session=` and the
browser). That is not this active id: a Telegram switch must not send a
refresh of the phone browser to a different conversation.

## Persistence

`state/sessions.json` is the registry. Transcripts are
`state/transcripts/<id>.jsonl`. Sessions started outside Auto are adopted at
boot (and on "Refresh sessions") from each agent's own `session/list`, with
their agent recorded — see [ACP](acp.md#adopting-sessions-started-elsewhere).
An adopted session's history is captured from its first `session/load` replay.
Archiving drops the live process, not the log. A watcher tick that lands
afterwards cannot set the session back to idle — that used to
bring it back into the list, so × looked like it needed two taps.

## Failures caught by shape

Upstream blips (`RetriableError`, `PING timed out`, rate limits) and leaked
tool-call markup (`<|…|>` pairs) arrive as ordinary assistant prose. Auto
recognises them and complains rather than treating a printed tool call as a
finished answer.

## Related

- [Desktop chats](desktop-chats.md)
- [Desktop threads](desktop-threads.md)
- [ACP](acp.md)
- [Queue](queue.md)
- [Host](host.md)
