// App metadata (single source of truth for the version shown in the About dialog).
export const APP_VERSION = "1.0.2";
export const APP_AUTHOR = "Jared Taylor";
export const GITHUB_URL = "https://github.com/Vaei/DodoTabs";
export const APP_LICENSE = "AGPL-3.0";

// Metronome (mic) sync isn't reliable yet, so its UI is hidden. The feature and all
// its code remain; flip this to true to surface the mic button, Sync toggle and the
// related settings again.
export const METRONOME_SYNC = false;

export interface LicenseEntry {
  name: string;
  license: string;
  url?: string;
}

// Third-party components bundled in DodoTabs, shown on the About > Licenses screen.
export const THIRD_PARTY_LICENSES: LicenseEntry[] = [
  {
    name: "alphaTab (notation + playback engine)",
    license: "MPL-2.0",
    url: "https://github.com/CoderLine/alphaTab",
  },
  {
    name: "Sonivox EAS soundfont",
    license: "Apache-2.0",
    url: "https://github.com/CoderLine/alphaTab",
  },
  {
    name: "Bravura music font",
    license: "SIL OFL-1.1",
    url: "https://github.com/steinbergmedia/bravura",
  },
  { name: "Inter font", license: "SIL OFL-1.1", url: "https://rsms.me/inter/" },
  {
    name: "Space Grotesk font",
    license: "SIL OFL-1.1",
    url: "https://github.com/floriankarsten/space-grotesk",
  },
  { name: "Tauri", license: "MIT / Apache-2.0", url: "https://tauri.app" },
  { name: "React", license: "MIT", url: "https://react.dev" },
  { name: "Vite", license: "MIT", url: "https://vitejs.dev" },
  {
    name: "Rust crates (axum, tokio, tower-http, serde, walkdir, local-ip-address)",
    license: "MIT / Apache-2.0",
  },
];

// Playback speed and zoom presets, shared by the transport controls and the
// Ctrl/Shift + wheel handlers.
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
export const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 2;

/** Step to the next/previous preset relative to the current (possibly fine-grained) value. */
export function stepPreset(current: number, presets: number[], dir: number): number {
  const sorted = [...presets].sort((a, b) => a - b);
  const eps = 1e-6;
  if (dir > 0) {
    return sorted.find((p) => p > current + eps) ?? sorted[sorted.length - 1];
  }
  return [...sorted].reverse().find((p) => p < current - eps) ?? sorted[0];
}

export function clampSpeed(value: number): number {
  const clamped = Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
  return Math.round(clamped * 100) / 100;
}
