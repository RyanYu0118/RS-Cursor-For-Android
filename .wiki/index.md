# Auto

Remote control for Cursor's agent. Start at [overview](overview.md).

# Concepts

* [Sessions](concepts/sessions.md) - One conversation, desktop or ACP, tagged with its agent, with its own transcript
* [Transcripts](concepts/transcripts.md) - Append-only JSONL; clients cache the tail, host stays authoritative
* [Host](concepts/host.md) - One process on 4331: HTTP, WebSocket, restart, machine name
* [Supervise](concepts/supervise.md) - Watchdog; runs setup checks; prints the Tailscale URL
* [Access](concepts/access.md) - Tailscale-only reachability, setup checklist, no Auto login
* [Cursor window](concepts/cursor-window.md) - Typing, pressing, dynamic model controls, and paste over the debug port
* [Desktop chats](concepts/desktop-chats.md) - Carry on a Cursor IDE chat from the phone
* [Desktop bridge](concepts/desktop-bridge.md) - Named-pipe send, gate, outbox
* [Desktop threads](concepts/desktop-threads.md) - Reading replies from `state.vscdb`
* [Tool lanes](concepts/tool-lanes.md) - Activity / file-change / card / hide for tool bubbles
* [ACP](concepts/acp.md) - `cursor-agent acp` or `opencode acp` sessions, one picker shape for both
* [Approvals](concepts/approvals.md) - Permissions, automatic mode transitions, questions, plans, and deliberate Keep / Undo / Redo
* [Queue](concepts/queue.md) - Messages waiting behind a turn, in Auto or in Cursor
* [Telegram](concepts/telegram.md) - Bot projection with model price bands
* [Web](concepts/web.md) - PWA lifecycle, transcript cache, repo-grouped rail with agent marks, remembered model per agent, responsive model sheet, and Home Screen behaviour
* [Usage](concepts/usage.md) - Context dial, relative model price bands, and Cursor Models / Other Models account quotas
* [Browser](concepts/browser.md) - Headed Chrome, client-themed screencast, not recorded
* [Terminals](concepts/terminals.md) - node-pty shells for the user and the agent
* [Projects](concepts/projects.md) - Folders as Cursor sees them, plus a drives/folders browser for new ones
* [Display settings](concepts/settings.md) - Host-owned chat detail (quiet / normal / verbose) and the turn clock, shared by web and Telegram
* [Skills](concepts/skills.md) - Agent instructions, repo workflow, this wiki

# Entities

* [Auto](overview.md) - The host and its two projections
