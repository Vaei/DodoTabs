// Platform helpers. The same web frontend runs in three places:
//  - Tauri desktop (Windows): the "host" that can open local files AND serve a tab folder over LAN.
//  - Tauri Android: a client (local file picker + connects to a host).
//  - Plain browser (Firefox): a client.
//
// `isDesktopHost()` gates the host-only features (native dialogs, fs, the LAN server).

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
