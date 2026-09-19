---
type: Concept
title: Projects
description: The machine's folders as Cursor itself sees them — open windows, then everything it remembers.
tags: [projects, workspaces]
status: stable
sources:
  - id: projects
    resource: /src/core/projects.mjs
    title: Project list
  - id: chats
    resource: /src/core/desktop-chats.mjs
    title: Chats per workspace
  - id: fs-browse
    resource: /src/core/fs-browse.mjs
    title: Drives and folders on this machine
generated: { by: agent, at: 2026-09-19T00:00:00Z }
---

# Projects

Auto does not invent "your projects". It is a remote control, so the list
is the desktop's list: folders open in a Cursor window right now, then
every workspace Cursor remembers. Folders Auto already has a session in
stay on the rail even if the IDE forgot them.

In the [web](web.md) rail each project is its own accordion — the repo is
the parent and its chats and sessions the rows inside. There is no separate
**Projects** row any more: sessions and Cursor's chats are consolidated
under the folder they belong to.

Read from `%APPDATA%\Cursor\User` — `globalStorage/storage.json` for open
windows (including multi-root `.code-workspace` files) and
`workspaceStorage` for history. Cheap enough to re-read whenever someone
asks. Nothing here talks to the agent.

When Cursor's list does not have the folder, **Browse…** in the New session
sheet reads the machine directly (`src/core/fs-browse.mjs`, the `fs.list`
op): the drives and Home as roots, then the directories under each. Hidden
folders, `node_modules`, and the recycle bin are left out; the list is
read-only and never touches the agent.

A project's desktop chats are keyed by that folder's `workspaceId`. See
[desktop chats](desktop-chats.md).

Switching Auto's active folder is the [session](sessions.md) API, not a
`cd`. The `switch-repo` skill is the procedure.

## Related

- [Sessions](sessions.md)
- [Web](web.md)
- [Telegram](telegram.md)
