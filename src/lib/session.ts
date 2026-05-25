// Last-session snapshot: the full transient player state (transport toggles, the looped
// section, the cursor position) plus the track mixer, so reopening the app can pick up
// exactly where you left off. Only the most recent session is kept, keyed by file name so
// a stale session never gets applied to a different tab. This is distinct from the per-tab
// "saved setup" (tabSettings): that is a named preset the user curates and manages; this is
// an invisible "where I left off" that is written automatically and restored on startup.

import type { TabTrackSetting } from "./tabSettings";

export interface SessionState {
  fileName: string;
  speed: number;
  zoom: number;
  layout: "page" | "horizontal";
  metronome: boolean;
  countInMode: 0 | 1 | 2;
  snapToBar: boolean;
  looping: boolean;
  // The looped section as a midi-tick range, or null when nothing is selected.
  selection: { startTick: number; endTick: number } | null;
  // Cursor position in midi ticks, so playback resumes where you left off.
  position: number;
  tracks: TabTrackSetting[];
}

const KEY = "dodotabs.session";
/** When not "0" (the default), the last session is restored on startup after the tab loads. */
export const RESTORE_SESSION_KEY = "dodotabs.restoreSession";

export function getSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && Array.isArray(parsed.tracks)
      ? (parsed as SessionState)
      : null;
  } catch {
    return null;
  }
}

export function setSession(session: SessionState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage full / unavailable - ignore */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isRestoreSession(): boolean {
  return (localStorage.getItem(RESTORE_SESSION_KEY) ?? "1") !== "0";
}
