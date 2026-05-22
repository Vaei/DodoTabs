// Platform helpers. The same web frontend runs in three places:
//  - Tauri desktop (Windows): the "host" that can open local files AND serve a tab folder over LAN.
//  - Tauri Android: a client (local file picker + connects to a host).
//  - Plain browser (Firefox): a client.
//
// `isDesktopHost()` gates the host-only features (native dialogs, fs, the LAN server).
import { GITHUB_URL } from "./constants";

// Where a tab came from. Only `localPath` and `remote` can be reopened later
// (used for the recent-files list); `browser` file-input picks are not reopenable.
export type TabSource =
  | { kind: "localPath"; path: string }
  | { kind: "remote"; baseUrl: string; path: string }
  | { kind: "browser" };

export interface LoadedFile {
  name: string;
  data: Uint8Array;
  source: TabSource;
}

const SUPPORTED_EXTENSIONS = [
  ".gp",
  ".gp3",
  ".gp4",
  ".gp5",
  ".gpx",
  ".gp7",
  ".gp8",
  ".musicxml",
  ".xml",
  ".mxl",
  ".capx",
  ".alphatab",
  ".tex",
];

export const ACCEPT_ATTR = SUPPORTED_EXTENSIONS.join(",");

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isTauriRuntime(): boolean {
  return inTauri();
}

/** Synchronous best-guess for "is this the Android client", from the user agent.
 * Lets the mobile layout render on the very first paint (no desktop-UI flash on
 * launch/resume); the async {@link isDesktopHost} still confirms it afterwards. */
export function isLikelyMobile(): boolean {
  return (
    inTauri() &&
    typeof navigator !== "undefined" &&
    /android/i.test(navigator.userAgent)
  );
}

/** True if the filename has a supported tab extension. */
export function isSupportedTabFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Build a LoadedFile from an absolute path (Tauri drag-drop / dialog). */
export async function fileFromPath(path: string): Promise<LoadedFile> {
  const data = await readTauriFile(path);
  return { name: basename(path), data, source: { kind: "localPath", path } };
}

/** Build a LoadedFile from a browser File (HTML5 drag-drop / input). */
export async function fileFromDomFile(file: File): Promise<LoadedFile> {
  const buffer = await file.arrayBuffer();
  return { name: file.name, data: new Uint8Array(buffer), source: { kind: "browser" } };
}

// Tauri reports the OS; only desktop platforms host the LAN server.
let cachedIsDesktopHost: boolean | null = null;

export async function isDesktopHost(): Promise<boolean> {
  if (cachedIsDesktopHost !== null) return cachedIsDesktopHost;
  if (!inTauri()) {
    cachedIsDesktopHost = false;
    return false;
  }
  try {
    const { platform } = await import("@tauri-apps/plugin-os");
    const p = platform();
    cachedIsDesktopHost = p === "windows" || p === "macos" || p === "linux";
  } catch {
    // If the OS plugin isn't available, assume any Tauri context can host.
    cachedIsDesktopHost = true;
  }
  return cachedIsDesktopHost;
}

/** Open a local tab file. Uses the native dialog under Tauri, a file input in the browser. */
export async function openLocalFile(): Promise<LoadedFile | null> {
  if (inTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Tab files",
          extensions: SUPPORTED_EXTENSIONS.map((e) => e.replace(/^\./, "")),
        },
      ],
    });
    if (!selected || typeof selected !== "string") return null;
    const data = await readTauriFile(selected);
    return { name: basename(selected), data, source: { kind: "localPath", path: selected } };
  }

  return openFileViaInput();
}

/** Opens a URL in the system's default browser (Tauri), or a new tab (browser). */
export async function openExternal(url: string): Promise<void> {
  if (inTauri()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      /* fall through to window.open */
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Reads a file by absolute path via the Rust `read_file` command (Tauri only). */
export async function readTauriFile(path: string): Promise<Uint8Array> {
  const { invoke } = await import("@tauri-apps/api/core");
  const bytes = await invoke<number[]>("read_file", { path });
  return new Uint8Array(bytes);
}

function openFileViaInput(): Promise<LoadedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT_ATTR;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const buffer = await file.arrayBuffer();
      resolve({ name: file.name, data: new Uint8Array(buffer), source: { kind: "browser" } });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

// ---- Tauri command wrappers (host only) ---------------------------------

export interface LibraryStatus {
  folder: string | null;
  url: string | null;
}

export async function startLibraryServer(folder: string): Promise<LibraryStatus> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LibraryStatus>("start_library_server", { folder });
}

export async function getLibraryStatus(): Promise<LibraryStatus> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LibraryStatus>("get_library_status");
}

export async function pickLibraryFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
}

// ---- Remote library (client) --------------------------------------------

export interface RemoteTab {
  path: string; // relative path used as id
  name: string; // display name
}

function normalizeBase(url: string): string {
  let u = url.trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, "");
}

export async function fetchRemoteTabs(baseUrl: string): Promise<RemoteTab[]> {
  const base = normalizeBase(baseUrl);
  const res = await fetch(`${base}/api/tabs`);
  if (!res.ok) throw new Error(`Library responded ${res.status}`);
  return (await res.json()) as RemoteTab[];
}

export async function fetchRemoteTab(baseUrl: string, path: string): Promise<LoadedFile> {
  const base = normalizeBase(baseUrl);
  const res = await fetch(`${base}/api/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to load tab (${res.status})`);
  const buffer = await res.arrayBuffer();
  return {
    name: basename(path),
    data: new Uint8Array(buffer),
    source: { kind: "remote", baseUrl: base, path },
  };
}

// ---- Local library (download destination on the client) -----------------
//
// Tabs fetched from a host can be saved to a folder on this device so they can
// be played later without the host online. On Android arbitrary user folders
// aren't writable, so we use the app's own data folder; on desktop the user
// picks a real folder; a plain browser has no folder (it uses a normal download).

const LOCAL_LIB_KEY = "dodotabs.localLibrary";

/** The configured download folder, or null if the user hasn't set one up. */
export function getLocalLibrary(): string | null {
  return localStorage.getItem(LOCAL_LIB_KEY);
}

/** Choose / initialize the local library folder. Returns the path (or null if cancelled). */
export async function setupLocalLibrary(): Promise<string | null> {
  if (!inTauri()) return null; // browser has no persistent folder
  let dir: string | null;
  if (await isDesktopHost()) {
    dir = await pickLibraryFolder();
  } else {
    const { invoke } = await import("@tauri-apps/api/core");
    dir = await invoke<string>("default_library_dir");
  }
  if (dir) localStorage.setItem(LOCAL_LIB_KEY, dir);
  return dir;
}

/** Saves tab bytes into the local library folder. Returns the written path. */
export async function saveToLibrary(
  dir: string,
  file: { name: string; data: Uint8Array }
): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("save_tab", {
    dir,
    name: file.name,
    bytes: Array.from(file.data),
  });
}

/** Lists tabs already saved in the local library folder. */
export async function listLocalTabs(dir: string): Promise<RemoteTab[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<RemoteTab[]>("list_local_tabs", { dir });
}

/** Loads a tab from the local library by its folder-relative path. */
export async function loadLocalTab(dir: string, rel: string): Promise<LoadedFile> {
  const path = `${dir}/${rel}`;
  const data = await readTauriFile(path);
  return { name: basename(rel), data, source: { kind: "localPath", path } };
}

/** Deletes a tab from the local library folder. */
export async function deleteLocalTab(dir: string, rel: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("delete_local_tab", { dir, path: rel });
}

/** Desktop only: check for a newer release and, if the user agrees, install + relaunch.
 * Returns a short status string to show the user. */
export async function checkForUpdates(): Promise<string> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return "You're on the latest version.";
  const { ask } = await import("@tauri-apps/plugin-dialog");
  const ok = await ask(`DodoTabs ${update.version} is available. Download and install now?`, {
    title: "Update available",
    kind: "info",
    okLabel: "Update",
    cancelLabel: "Later",
  });
  if (!ok) return `Version ${update.version} is available.`;
  await update.downloadAndInstall();
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
  return "Restarting to finish the update...";
}

function versionIsNewer(remote: string, local: string): boolean {
  const r = remote.split(".").map((n) => parseInt(n, 10) || 0);
  const l = local.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

/** Compares the running version to the latest GitHub release (used on Android,
 * which has no auto-updater). Returns the newer release's version + page URL, or
 * null if already up to date. */
export async function latestReleaseIfNewer(
  current: string
): Promise<{ version: string; url: string } | null> {
  const api = `${GITHUB_URL.replace("https://github.com/", "https://api.github.com/repos/")}/releases/latest`;
  const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = (await res.json()) as { tag_name?: string; html_url?: string };
  const version = (data.tag_name ?? "").replace(/^v/, "");
  if (!version || !versionIsNewer(version, current)) return null;
  return { version, url: data.html_url ?? `${GITHUB_URL}/releases/latest` };
}

/** Native yes/no confirmation dialog. Returns true if the user confirms. */
export async function confirmDelete(name: string): Promise<boolean> {
  const { confirm } = await import("@tauri-apps/plugin-dialog");
  return confirm(`Delete "${name}" from this device?`, {
    title: "Delete tab",
    kind: "warning",
    okLabel: "Delete",
    cancelLabel: "Cancel",
  });
}

/** Triggers a normal browser download (used when there is no Tauri filesystem). */
export function downloadInBrowser(file: { name: string; data: Uint8Array }): void {
  const blob = new Blob([file.data as BlobPart], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
