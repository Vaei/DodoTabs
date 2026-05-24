// Per-tab saved setup: the track mixer (mute/solo/volume/show-hide) plus the playback
// speed and zoom, keyed by file name so reopening a tab can restore how you had it.
// Stored as one JSON blob mapping file name -> settings, which makes the management
// list (see SettingsModal) a simple key listing with selective/mass delete.

export interface TabTrackSetting {
  index: number;
  muted: boolean;
  soloed: boolean;
  volume: number;
  display: "auto" | "shown" | "hidden";
}

export interface TabSettings {
  tracks: TabTrackSetting[];
  speed: number;
  zoom: number;
}

const KEY = "dodotabs.tabSettings";
/** When "1", track/speed/zoom changes are saved automatically; otherwise save is manual. */
export const AUTO_SAVE_TAB_KEY = "dodotabs.autoSaveTab";

type Store = Record<string, TabSettings>;

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function saveStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full / unavailable - ignore */
  }
}

export function getTabSettings(name: string): TabSettings | null {
  const s = loadStore()[name];
  return s && Array.isArray(s.tracks) ? s : null;
}

export function setTabSettings(name: string, settings: TabSettings): void {
  const store = loadStore();
  store[name] = settings;
  saveStore(store);
}

export function deleteTabSettings(name: string): void {
  const store = loadStore();
  if (name in store) {
    delete store[name];
    saveStore(store);
  }
}

export function deleteAllTabSettings(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** File names that currently have saved settings, sorted alphabetically. */
export function listTabSettings(): string[] {
  return Object.keys(loadStore()).sort((a, b) => a.localeCompare(b));
}

export function hasTabSettings(name: string): boolean {
  return name in loadStore();
}

export function isAutoSaveTab(): boolean {
  return localStorage.getItem(AUTO_SAVE_TAB_KEY) === "1";
}
