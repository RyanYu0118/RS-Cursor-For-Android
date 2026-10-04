---
type: Concept
title: Android shell
description: Native Jetpack Compose pad client for Auto — immersive light field, liquid-glass panels, skeleton until WS ready.
tags: [android, compose, pad, glass]
status: stable
sources:
  - id: android
    resource: /android
    title: Android Gradle project
  - id: main
    resource: /android/app/src/main/java/com/ryanstudio/rscursor/MainActivity.kt
    title: Compose MainActivity
  - id: glass
    resource: /android/app/src/main/java/com/ryanstudio/rscursor/ui/theme/Glass.kt
    title: Immersive light + liquid glass
  - id: repo
    resource: /android/app/src/main/java/com/ryanstudio/rscursor/data/HostRepository.kt
    title: HostRepository + WebSocket
  - id: web-fallback
    resource: /android/app/src/main/java/com/ryanstudio/rscursor/WebShellActivity.kt
    title: WebView fallback
  - id: settings
    resource: /android/app/src/main/java/com/ryanstudio/rscursor/SettingsActivity.kt
    title: Host URL settings
  - id: cursor-sidebar
    resource: /src/core/cursor-sidebar.mjs
    title: Pinned + row actions through Cursor's services
generated: { by: agent, at: 2026-10-04T08:50:00Z }
---

# Android shell

Native Jetpack Compose client for Auto on a pad. The host still runs on
the computer ([Host](host.md)); the app talks to it over WebSocket /
REST the same way the [Web](web.md) PWA does. Chat, rail, composer, and
the + menu are Compose — not a WebView.

## Look

The shell keeps an **immersive light field** behind a **single rounded
glass chat window** (transcript + composer). The top bar and session rail
stay compact and flat — closer to the [Web](web.md) layout — without their
own glass cards. Page changes and transcript rows use short fade/slide transitions. Closing
the rail animates its width (260ms), so the chat pane grows leftward into
the space instead of jumping when the slot disappears; opening does the
reverse. Row gaps and the 48dp title bar are tightened
for a denser pad layout. Assistant and user prose render as **Markdown**,
not raw source.

Every secondary menu and dialog shares one immersive glass look
([`GlassOverlays.kt`](/android/app/src/main/java/com/ryanstudio/rscursor/ui/theme/GlassOverlays.kt)):
a deep tinted sheet lit from inside by slowly drifting cyan / violet / rose
glows, a top sheen and the glass edge — the same light field as the page.
`GlassMenu` replaces `DropdownMenu` (rail row menu, composer + / mode /
model): it opens below its anchor or above when there is no room, springs
out of that side (scale + fade + slide) and fades back on close. Inline
submenus (Move to ›, Copy ›) fold open with the chevron turning.
`GlassDialog` (Rename, Edit Icon) rises over an animated light-tinted scrim
and plays back out before it is removed; buttons, fields and icon chips are
glass too. The host-URL screen is the same field: a lit glass card, not a
Material toolbar and text field. It opens with a cross-fade, the card
springing up and in while the header slides from the left; back (button or
gesture) and save play that in reverse before the activity finishes, and the
error line folds open rather than popping.

## Side rail

Mirrors Cursor Agents / the web rail: **New Chat**, **Search** (filter),
**Pinned**, then **Repositories** as accordions (no separate Recent list —
Cursor Agents does the same). Rows come from the host `sidebar` snapshot
(per-workspace desktop chats), not a flat recent pool; empty drafts stay out
of the lists.

**Pinned and every row action go through the Agents window's own
services, never its UI.** Pressing the row menu worked but opened menus on
the computer's screen and needed Cursor in front; now nothing is clicked and
Cursor can stay minimised. The host
([`cursor-sidebar.mjs`](/src/core/cursor-sidebar.mjs)) runs a script beside
the workbench's service registry (`CursorCdp.inAgentsWindow`, the same
captured `__autoData` the model switch uses) and looks services up by their
registered id, not Cursor's minified class names:

| Action | Service call (mirrors the sidebar's own handler) |
| --- | --- |
| Pinned list | `cloudAgentRepositoryService.pinnedAgentIds` → headers from `agentRepositoryService`, archived dropped, newest `lastUpdatedAt` first (Cursor's order) |
| Pin / Unpin | `cloudAgentRepositoryService.pinAgent` / `unpinAgent` |
| Archive | `agentRepositoryService.archiveAgent(id, {cleanupWorktrees})` + `removeArchivedPinnedAgentIds` — no undo toast |
| Mark as (Un)read | `markAgentUnread` / `markAgentRead` by `hasUnreadMessages` |
| Fork | `duplicateAgent` — the fork is not opened on the computer |
| Rename | header name + `composerDataHandle.setData('name')` + `setAllComposersData` + `composerService.renameComposer` + persist/save (rolled back on failure); cloud chats `renameCloudAgent` |
| Edit Icon | header `projectAppearance` + `updateComposerDataAsync` + `setAllComposersData` + `saveComposers`; cloud chats `updateCloudAgentAppearance` |
| Move to | `glassAgentMigrationService.getMigrationTargetsForAgent` / `migrateAgent` |
| Copy | Agent ID = id; Branch = tracked repos' active branches; Transcript = the chat's bubbles as `## User` / `## Assistant` markdown — returned to the phone, the computer's clipboard untouched |

The Pinned list is re-read every 8 s (about 30 ms) and `projects` is
broadcast when it changes; cloud pins with no header are skipped, as in
Cursor. With no window answering for a minute, the snapshot falls back to the
`projectAppearance` guess on disk.

Tapping an Auto session attaches; tapping a desktop-only chat sends
`desktop.continue`. Repo **+** starts `session.create` in that folder.
Long-press a chat (or Pinned row) for Cursor's own row menu, in its order:
**Pin/Unpin**, **Rename**, **Edit Icon**, **Mark as Unread**, **Fork**,
**Move to ›**, **Copy ›**, **Archive**.

- **Edit Icon** (`desktop.chat.icons`) offers Cursor's ten colours and its
  icon catalog, decoded once from the installed `workbench.glass.main.js`
  (front-coded names, "legacy" / "filled" dropped, featured icons first);
  search filters by words. An appearance is always icon + colour, so a colour
  picked before any icon waits on the host until one is chosen. `clear`
  removes it.
- **Move to ›** is read when opened (`desktop.chat.menu` with `sub: "Move
  to"`); the target is matched by id, "label detail", or label.
- An Auto-only session (no Cursor chat) offers only Archive.

A chat the Agents window does not know answers with an error; the
`composerHeaders` write is only used for Pin / Unpin / Archive when no window
answers at all. While a session is `busy` / `starting`, that row (and
its Pinned twin) shows a spinner left of the title and the same left→right
white **gleam** on the title glyphs as the live-step line.

## Connection

The WebSocket bumps a generation on each connect so a replaced socket's late
`onClosed` cannot schedule another reconnect and flash "重连中" every second.
Attach paints a short tail; scrolling to the top (or tapping the earlier row)
asks `transcript.more` and prepends older history without jumping the viewport.
Composer Enter sends; Shift+Enter inserts a newline.

Tool calls paint as Cursor's **work fold** (summary + expandable steps + live
subtask gleam), using the same lane table as the [web](web.md) /
[tool lanes](tool-lanes.md). The gleam is a white highlight swept across the
**glyphs** (Compose `TextStyle` brush), not a background wash. Only the live
fold / trailing Thinking strip gleams; finished **Thought** blocks auto-fold
and expand on tap.

## Why it exists

A Home Screen PWA (and the earlier thin WebView shell) could not reliably
open the system image picker for Files. The native app uses Android's
photo picker and paints its own UI, so every main control is a real
Material component.

The old WebView Activity remains as **网页版** (debug / compare). Default
launch is Compose.

## Skeleton

Cold start with a host URL shows a low-fi skeleton (rail grey bars,
bubble stubs, bottom bar) with a light shimmer until `hello` /
`attached` arrive. If the transcript is still catching up, only the main
pane stays skeleton. Reconnect shows a top banner rather than a white
flash.

The skeleton is never a dead end: after about a second a glass card floats
over it with the host URL it is dialling, and once an attempt fails, the
retry count and error plus **重试** and **更改主机地址** (opens the host
settings). The socket's connect timeout is 6 s. Saving a different host URL
drops everything tied to the old one — session id, transcript seq, sidebar,
rail — so the new host is a clean cold start rather than a replay of a stale
`fromSeq`.

## What v1 covers

- Host URL settings ([SettingsActivity](/android/app/src/main/java/com/ryanstudio/rscursor/SettingsActivity.kt))
- Side rail: Agents-style Pinned / Repositories, attach or
  `desktop.continue`, new session (global or per folder); busy chats get a
  spinner + title gleam
- Transcript: user / assistant text, image thumbs (tap to view full size),
  tool rows, permission and question cards; Cursor-style **N Queued** card
  above the composer (Start Multitasking / × / tap to edit); scroll-up loads
  older history (`transcript.more`)
- Composer: text, send / stop (send still queues while busy), draft sync,
  attachments
- Plus menu: mode, Files (system gallery), model list (trimmed)

Browser and Terminals tabs are not ported yet.

## Protocol

[`HostRepository`](/android/app/src/main/java/com/ryanstudio/rscursor/data/HostRepository.kt)
opens `ws(s)://host/?session=&fromSeq=`, handles `hello` / `attached` /
`record` / `sessions` / `projects` / `draft` / `queue`, and sends `attach`,
`prompt`, `cancel`, `session.create`, `desktop.continue`, `projects.list`,
`desktop.chat` (pin / unpin / rename / unread / fork / move / copy /
archive), `desktop.chat.menu`, `desktop.chat.icons`,
`session.draft`, `session.mode`, `session.model`, `permission`. Images load
from `GET /api/image?session=&path=`.

## Icon

Launcher uses the studio mark [`src/web/rs-logo.png`](/src/web/rs-logo.png),
letterboxed onto a white tile with safe padding (legacy ~58%, adaptive
foreground ~52%). Regenerate with
`powershell -File scripts/android-icons.ps1`.

## First launch

1. Install the debug APK (`RS-Cursor-0.1.0-debug.apk`).
2. Open **主机设置** and enter the computer's Auto URL, for example
   `http://100.x.y.z:4331` (Tailscale IP + port).
3. Save — the app connects over WebSocket and fills the skeleton.

## Build

From the repo (JDK 17, Android SDK with platform 35):

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\cursor-pad\.jdk\jdk-17.0.20.1+1"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:ANDROID_HOME = "$env:USERPROFILE\cursor-pad\.sdk"
cd android
.\gradlew.bat assembleDebug
```

`gradlew.bat` prefers `java` on `PATH` over `JAVA_HOME`, and this machine's
system Java is 25, which Gradle 8.9 rejects with a bare "25.0.2" — so JDK 17
has to go first on `PATH`.

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.
Copy `local.properties.example` to `local.properties` and set `sdk.dir`
if the SDK is not the cursor-pad one.

## Related

- [Web](web.md) — same host protocol; PWA remains available
- [Access](access.md) — Tailscale reachability of the host
- [Host](host.md) — port 4331
