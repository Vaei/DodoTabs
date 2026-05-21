// App metadata (single source of truth for the version shown in the About dialog).
export const APP_VERSION = "1.0.0-beta";
export const APP_AUTHOR = "Jared Taylor";
export const GITHUB_URL = "https://github.com/Vaei/DodoTabs";

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
