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
generated: { by: agent, at: 2026-09-26T14:30:00Z }
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
own glass cards. Assistant and user prose render as **Markdown**, not raw
source.

## Side rail

Mirrors Cursor Agents / the web rail: **New Chat**, **Search** (filter),
**Pinned**, **Recent**, then **Repositories** as accordions. Rows come from
the host `sidebar` snapshot (plus Auto sessions and recent desktop chats).
Tapping an Auto session attaches; tapping a desktop-only chat sends
`desktop.continue`. Repo **+** starts `session.create` in that folder.

## Connection

The WebSocket bumps a generation on each connect so a replaced socket's late
`onClosed` cannot schedule another reconnect and flash "重连中" every second.
Attach paints a short tail; scrolling to the top (or tapping the earlier row)
asks `transcript.more` and prepends older history without jumping the viewport.
Composer Enter sends; Shift+Enter inserts a newline.

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

## What v1 covers

- Host URL settings ([SettingsActivity](/android/app/src/main/java/com/ryanstudio/rscursor/SettingsActivity.kt))
- Side rail: Agents-style Pinned / Recent / Repositories, attach or
  `desktop.continue`, new session (global or per folder)
- Transcript: user / assistant text, image thumbs, tool rows, permission
  and question cards, queue strip; scroll-up loads older history
  (`transcript.more`)
- Composer: text, send / stop, draft sync, attachments
- Plus menu: mode, Files (system gallery), model list (trimmed)

Browser and Terminals tabs are not ported yet.

## Protocol

[`HostRepository`](/android/app/src/main/java/com/ryanstudio/rscursor/data/HostRepository.kt)
opens `ws(s)://host/?session=&fromSeq=`, handles `hello` / `attached` /
`record` / `sessions` / `projects` / `draft` / `queue`, and sends `attach`,
`prompt`, `cancel`, `session.create`, `desktop.continue`, `projects.list`,
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
$env:ANDROID_HOME = "$env:USERPROFILE\cursor-pad\.sdk"
cd android
.\gradlew.bat assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.
Copy `local.properties.example` to `local.properties` and set `sdk.dir`
if the SDK is not the cursor-pad one.

## Related

- [Web](web.md) — same host protocol; PWA remains available
- [Access](access.md) — Tailscale reachability of the host
- [Host](host.md) — port 4331
