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

The manifest already requests the `RECORD_AUDIO` permission used by metronome sync. Dev
builds allow cleartext HTTP so the webview can reach a `http://<lan-ip>` library; a release
APK needs `usesCleartextTraffic` enabled (or a network-security-config scoped to private
ranges) for the LAN library to work.

## Supported file formats

`.gp .gp3 .gp4 .gp5 .gpx .gp7 .gp8` (Guitar Pro), `.musicxml .xml .mxl` (MusicXML),
`.capx` (Capella), `.alphatab .tex` (AlphaTex).

## License

DodoTabs is licensed under the [GNU AGPL-3.0](LICENSE). It bundles third-party components
under their own licenses: alphaTab (MPL-2.0), the Sonivox EAS soundfont (Apache-2.0), the
Bravura, Inter and Space Grotesk fonts (SIL OFL-1.1), and the Tauri/React stack
(MIT/Apache-2.0). The full list is in the in-app **About -> Licenses** screen.
