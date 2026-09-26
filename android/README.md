# RS Cursor — Android shell

Thin `WebView` wrapper for Auto's existing web UI. The Auto host still runs
on the computer (`:4331`); this app only opens that URL and routes
`<input type=file>` through the system picker.

## Icon

Studio mark from `../src/web/rs-logo.png`, padded so launchers do not crop
it (`scripts/android-icons.ps1`).

## Build

Needs JDK 17 and an Android SDK (API 35).

```powershell
copy local.properties.example local.properties
# edit sdk.dir

$env:JAVA_HOME = "$env:USERPROFILE\cursor-pad\.jdk\jdk-17.0.20.1+1"
$env:ANDROID_HOME = "$env:USERPROFILE\cursor-pad\.sdk"
.\gradlew.bat assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

## Use

1. Install the APK on the pad.
2. Enter the computer's Auto URL (e.g. `http://100.x.y.z:4331`).
3. Use + → Files — the system gallery should open.
