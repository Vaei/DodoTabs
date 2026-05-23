# DodoTabs

A guitar-tab player built on [alphaTab](https://alphatab.net), wrapped with **Tauri v2**.
Renders and plays back Guitar Pro / MusicXML / Capella / AlphaTex files with a dark,
modern interface: beat-cursor following, auto-scroll, per-track mute/solo/volume,
tempo, looping, metronome, count-in, zoom and layout switching.

Runs on two platforms from one React frontend:

- **Windows desktop** (Tauri): opens local files and shares a folder of tabs over your LAN.
- **Android** (Tauri): opens local files, connects to a desktop's library over Wi-Fi, and
  downloads tabs for offline play.

DodoTabs plays structured tab files (Guitar Pro, MusicXML, Capella, AlphaTex), not plain
text tabs. To read your tabs on your phone, the desktop app can serve a folder of tab files
over Wi-Fi: grab them on your computer, then browse and play them on Android.

## Screenshots

### Windows

<img width="1408" height="820" alt="dodotabs_2026-05-22_14-53-15" src="https://github.com/user-attachments/assets/7c674964-0b92-44e7-86b4-9236f77fde29" />

### Android

#### Portrait

<img width="298" height="645" alt="dodotabs_android_portrait" src="https://github.com/user-attachments/assets/128c87fc-3c24-40a3-a57a-4ce7b08589f9" />

#### Landscape

<img width="932" height="430" alt="dodotabs_android_landscape" src="https://github.com/user-attachments/assets/dd26d1b0-a347-4f97-85fb-5637bd142edf" />

## Features

### Major

* **Plays real tab files with full audio.** Open Guitar Pro, MusicXML, Capella or
  AlphaTex files and hear them played back with a built-in instrument bank, not just
  read them.
* **Clear, dark score view.** A clean, distraction-free sheet that highlights the
  current beat and scrolls itself as the song plays, so you never lose your place.
* **Full playback control.** Play, pause, stop and scrub anywhere on the timeline.
* **Slow it down or speed it up.** Practice tricky parts at any speed from a quarter
  to double, set an exact target BPM, or zoom the notation in and out.
* **Loop any section.** Mark a passage and loop it to drill it, with an optional
  count-in before each repeat and snap-to-bar so loops land cleanly.
* **Per-track mixer.** Mute, solo and set the volume of each instrument, choose which
  tracks are shown on the sheet, and watch live meters show what is playing.
* **Built-in metronome and count-in** to keep time and to lead you in before playback.
* **Your tabs on every device.** One app for Windows, Android and the browser. Point
  the desktop app at a folder of tabs and browse and play them on your phone over
  Wi-Fi, or download them to the phone to keep for offline practice.

### Minor

* Recently opened list for one-tap reloading (middle-click or long-press to remove an
  entry).
* Drag and drop a tab file onto the window to open it.
* Pinch to zoom the score on a phone or tablet.
* Keyboard shortcuts for every transport action, with an on-screen cheat sheet.
* Mouse-wheel shortcuts over the score: Ctrl for speed, Shift for zoom, Alt for BPM.
* Middle-click a control to reset it to its default.
* Pick which speaker/output and microphone the app uses.
* Touch-friendly phone layout with swipe-or-tap drawers and floating play controls
  that adapt to portrait or landscape.
* Start playback in time with a physical metronome via the microphone (experimental;
  works best on desktop).

## Project layout

```
src/                 React + TypeScript frontend
  lib/useAlphaTab.ts   alphaTab API integration (the player engine binding)
  lib/runtime.ts       platform helpers (file open, Tauri commands, remote library)
  components/          ScoreView, TransportBar, TrackSidebar, LibraryPanel
src-tauri/           Rust/Tauri shell
  src/lib.rs           app setup, commands (start_library_server, read_file)
  src/server.rs        embedded axum LAN library server (/api/tabs, /api/file)
```

## Prerequisites

- Node.js 20+ and npm
- Rust (stable) plus the `x86_64-pc-windows-msvc` target (default on Windows)
- For Android: JDK 17, the Android SDK + NDK, the env vars `JAVA_HOME`, `ANDROID_HOME`,
  `NDK_HOME`, and the Rust Android targets (see [Android](#android))

## Develop and run

```bash
npm install

# Desktop app (Windows) with hot reload
npm run tauri dev

# Android app (USB device or emulator) with hot reload
npm run tauri android dev

# Production builds
npm run tauri build                # Windows
npm run tauri android build --apk  # Android APK
```

## Sharing a library (PC to phone)

1. On the desktop app, click **Library**, then **Choose a folder to share**, and pick a folder of tabs.
2. The app shows an address like `http://192.168.1.50:8088`.
3. On the Android app, open that address in DodoTabs' **Library**, **Connect to a library**
   field, hit **Connect**, and pick a tab (or download it for offline play).

The server binds `0.0.0.0` with permissive CORS and only serves supported tab extensions
from the chosen folder (path-traversal guarded).

## Android

The Android project is scaffolded under `src-tauri/gen/android`. To build it, install
JDK 17 and the Android SDK + NDK, set `JAVA_HOME`, `ANDROID_HOME` and `NDK_HOME`, and add
the Rust Android targets:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
npm run tauri android dev      # run on a connected device / emulator
npm run tauri android build    # build an APK
```

The manifest requests the `RECORD_AUDIO` permission used by metronome sync, and both debug
and release builds allow cleartext HTTP so the webview can reach a `http://<lan-ip>` library.

## Installing the Android app (sideload)

DodoTabs is distributed as a signed APK; no Play Store needed.

1. Get the APK: build it with `npm run tauri android build --apk` (output under
   `src-tauri/gen/android/app/build/outputs/apk/universal/release/`), or use one shared with you.
2. Copy the `.apk` to the phone (USB, email, a cloud drive, or a download link).
3. On the phone, open the file. The first time, Android asks to allow installs from this
   source: tap the prompt, turn on **Allow from this source**, go back, and open the APK again.
4. Tap **Install**. If Play Protect warns about an unknown app, choose **Install anyway**.

To update, just install a newer APK over the top; the shared signing key keeps your data and
settings. There is no auto-update on Android by design, so a new APK is shared when there is
a new version.

## Building and distributing releases

```bash
npm run tauri build                # Windows installer -> src-tauri/target/release/bundle/nsis/
npm run tauri android build --apk  # Signed Android APK (uses gen/android/key.properties)
```

The **desktop app auto-updates**: it checks GitHub Releases (`About -> Check for updates`),
and downloads/installs a newer version. To cut a release, build with the updater signing key
set so the update artifacts (`.sig`) are produced, then publish the installer and `.sig` to a
GitHub release along with a `latest.json` update manifest. The `latest.json` is generated for
you by [`tauri-action`](https://github.com/tauri-apps/tauri-action) in CI, or you can write it
by hand (version, notes, and the platform's installer URL + signature).

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw src-tauri\updater_key
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<updater key password>"
npm run tauri build
```

**Signing keys (keep safe, never commit, back up):**

- Updater key `src-tauri/updater_key` (its public key is in `tauri.conf.json`). Required to
  sign every desktop update; lose it and existing installs can't auto-update.
- Android keystore `src-tauri/gen/android/dodotabs-release.jks` (credentials in
  `key.properties`). Lose it and you can't ship updates to an installed app.

## Supported file formats

`.gp .gp3 .gp4 .gp5 .gpx .gp7 .gp8` (Guitar Pro), `.musicxml .xml .mxl` (MusicXML),
`.capx` (Capella), `.alphatab .tex` (AlphaTex).

## License

DodoTabs is licensed under the [GNU AGPL-3.0](LICENSE). It bundles third-party components
under their own licenses: alphaTab (MPL-2.0), the Sonivox EAS soundfont (Apache-2.0), the
Bravura, Inter and Space Grotesk fonts (SIL OFL-1.1), and the Tauri/React stack
(MIT/Apache-2.0). The full list is in the in-app **About -> Licenses** screen.

## Changelog

### 1.0.3
* Hid the metronome-sync feature for now (it wasn't reliable yet)

### 1.0.2
* Landscape: tracks panel open by default and no longer dims the score
* Landscape: smaller floating playback controls
* Clearer message when an update fails

### 1.0.1
* Keep the screen awake while playing (phone)
* Count-in can ignore the playback speed (setting)
* Fixed selecting the audio output device on Windows
* Check for updates from the About screen on Android
* Fixed a loop selection lingering after switching songs
* Metronome-sync and count-in fixes

### 1.0.0
* Initial Release
