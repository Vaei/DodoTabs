// Persistent "recently opened" list (localStorage). Only reopenable sources are
// stored: desktop file paths and remote-library tabs. Browser file-input picks
// can't be reopened (no persistent handle), so they're skipped.
import {
  type LoadedFile,
  type TabSource,
  fetchRemoteTab,
  readTauriFile,
} from "./runtime";

export interface RecentEntry {
  name: string;
  source: Extract<TabSource, { kind: "localPath" } | { kind: "remote" }>;
  openedAt: number;
}

const KEY = "dodotabs.recents";
const MAX = 15;

function sourceKey(s: RecentEntry["source"]): string {
  return s.kind === "localPath" ? `local:${s.path}` : `remote:${s.baseUrl}|${s.path}`;
}

export function loadRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(entries: RecentEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* storage full / unavailable - ignore */
  }
}

/** Records a freshly opened file. No-op for non-reopenable (browser) sources. */
export function addRecent(file: LoadedFile): RecentEntry[] {
  if (file.source.kind === "browser") return loadRecents();
  const entry: RecentEntry = {
    name: file.name,
    source: file.source,
    openedAt: Date.now(),
  };
  const key = sourceKey(entry.source);
  const next = [entry, ...loadRecents().filter((e) => sourceKey(e.source) !== key)];
  save(next);
  return next.slice(0, MAX);
}

/** Removes a single entry (matched by source) from the recents list. */
export function removeRecent(entry: RecentEntry): RecentEntry[] {
  const key = sourceKey(entry.source);
  const next = loadRecents().filter((e) => sourceKey(e.source) !== key);
  save(next);
  return next;
}

export function clearRecents(): RecentEntry[] {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return [];
}

/** Reconstructs a LoadedFile for a recent entry, or throws if it can't be reopened. */
export async function reopenRecent(entry: RecentEntry): Promise<LoadedFile> {
  if (entry.source.kind === "localPath") {
    const data = await readTauriFile(entry.source.path);
    return { name: entry.name, data, source: entry.source };
  }
  return fetchRemoteTab(entry.source.baseUrl, entry.source.path);
}
