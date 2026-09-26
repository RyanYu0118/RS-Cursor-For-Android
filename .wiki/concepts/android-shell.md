---
type: Concept
title: Android shell
description: Thin WebView app that opens Auto's web UI and hands file picks to the system gallery.
tags: [android, webview, pad]
status: stable
sources:
  - id: android
    resource: /android
    title: Android Gradle project
  - id: main
    resource: /android/app/src/main/java/com/ryanstudio/rscursor/MainActivity.kt
    title: WebView + file chooser
  - id: settings
    resource: /android/app/src/main/java/com/ryanstudio/rscursor/SettingsActivity.kt
    title: Host URL settings
generated: { by: agent, at: 2026-09-26T09:45:00Z }
---

# Android shell

A thin native wrapper around the [Web](web.md) UI. The host still runs on
the computer ([Host](host.md)); the pad only embeds that page in a
`WebView`.

## Why it exists

Installing Auto to the Home Screen as a PWA still leaves Files as a web
`<input type=file>`. Many Android WebViews / standalone Chromium builds
never open the system picker for that control. The shell implements
`WebChromeClient.onShowFileChooser` and starts the system gallery /
document UI, then writes the chosen `Uri`s back into the page — so the
existing composer attachments path keeps working.

It does **not** rewrite the chat UI, and it does **not** run the Auto host
on the pad.

## Icon

Launcher uses the studio mark [`src/web/rs-logo.png`](/src/web/rs-logo.png),
letterboxed onto a white tile with safe padding (legacy ~58%, adaptive
foreground ~52%) so round / squircle masks do not crop the R. Regenerate
with `powershell -File scripts/android-icons.ps1`.

## First launch

1. Install the debug APK (`RS-Cursor-0.1.0-debug.apk`).
2. Open **主机设置** and enter the computer's Auto URL, for example
   `http://100.x.y.z:4331` (Tailscale IP + port).
3. Save — the WebView loads that origin.

The URL is stored in app preferences and can be changed from the toolbar
menu later.

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

- [Web](web.md) — the page this shell loads
- [Access](access.md) — Tailscale reachability of the host
- [Host](host.md) — port 4331
