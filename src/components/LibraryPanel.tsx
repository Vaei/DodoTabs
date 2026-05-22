import { useEffect, useState } from "react";
import {
  type LoadedFile,
  type RemoteTab,
  isDesktopHost,
  isTauriRuntime,
  openLocalFile,
  pickLibraryFolder,
  startLibraryServer,
  getLibraryStatus,
  fetchRemoteTabs,
  fetchRemoteTab,
  getLocalLibrary,
  setupLocalLibrary,
  saveToLibrary,
  listLocalTabs,
  loadLocalTab,
  deleteLocalTab,
  confirmDelete,
  downloadInBrowser,
} from "../lib/runtime";
import { FileIcon, FolderIcon, NetworkIcon, CloseIcon, DownloadIcon, TrashIcon } from "./Icons";

interface Props {
  onLoad: (file: LoadedFile) => void;
  onClose: () => void;
}

const REMOTE_URL_KEY = "dodotabs.remoteUrl";

export default function LibraryPanel({ onLoad, onClose }: Props) {
  const [host, setHost] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [serveUrl, setServeUrl] = useState<string | null>(null);

  const [remoteUrl, setRemoteUrl] = useState(localStorage.getItem(REMOTE_URL_KEY) ?? "");
  const [remoteTabs, setRemoteTabs] = useState<RemoteTab[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // The download destination on this device, and what's already saved there.
  const tauri = isTauriRuntime();
  const [localLib, setLocalLib] = useState<string | null>(getLocalLibrary());
  const [localTabs, setLocalTabs] = useState<RemoteTab[]>([]);

  useEffect(() => {
    isDesktopHost().then(async (isHost) => {
      setHost(isHost);
      if (isHost) {
        try {
          const status = await getLibraryStatus();
          setFolder(status.folder);
          setServeUrl(status.url);
        } catch {
          /* server not started yet */
        }
      }
    });
    const lib = getLocalLibrary();
    if (lib && tauri) listLocalTabs(lib).then(setLocalTabs).catch(() => {});
  }, [tauri]);

  const handleOpenFile = async () => {
    const file = await openLocalFile();
    if (file) {
      onLoad(file);
      onClose();
    }
  };

  const handlePickFolder = async () => {
    setMessage(null);
    const picked = await pickLibraryFolder();
    if (!picked) return;
    setBusy(true);
    try {
      const status = await startLibraryServer(picked);
      setFolder(status.folder);
      setServeUrl(status.url);
    } catch (e) {
      setMessage(`Could not start library server: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const tabs = await fetchRemoteTabs(remoteUrl);
      setRemoteTabs(tabs);
      localStorage.setItem(REMOTE_URL_KEY, remoteUrl);
      if (tabs.length === 0) setMessage("Connected, but the library has no supported files.");
    } catch (e) {
      setMessage(`Could not reach library: ${String(e)}`);
      setRemoteTabs([]);
    } finally {
      setBusy(false);
    }
  };

  const handleLoadRemote = async (tab: RemoteTab) => {
    setBusy(true);
    try {
      const file = await fetchRemoteTab(remoteUrl, tab.path);
      onLoad(file);
      onClose();
    } catch (e) {
      setMessage(`Failed to load: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSetupLibrary = async () => {
    setMessage(null);
    try {
      const dir = await setupLocalLibrary();
      if (dir) {
        setLocalLib(dir);
        setLocalTabs(await listLocalTabs(dir));
      }
    } catch (e) {
      setMessage(`Could not set up the library folder: ${String(e)}`);
    }
  };

  const handleDownload = async (tab: RemoteTab) => {
    setMessage(null);
    setDownloading(tab.path);
    try {
      const file = await fetchRemoteTab(remoteUrl, tab.path);
      if (tauri) {
        if (!localLib) {
          setMessage("Set up a download folder first.");
          return;
        }
        await saveToLibrary(localLib, file);
        setLocalTabs(await listLocalTabs(localLib));
        setMessage(`Saved "${file.name}" to this device.`);
      } else {
        downloadInBrowser(file);
        setMessage(`Downloading "${file.name}".`);
      }
    } catch (e) {
      setMessage(`Download failed: ${String(e)}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleLoadLocal = async (tab: RemoteTab) => {
    if (!localLib) return;
    setBusy(true);
    try {
      const file = await loadLocalTab(localLib, tab.path);
      onLoad(file);
      onClose();
    } catch (e) {
      setMessage(`Failed to open: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLocal = async (tab: RemoteTab) => {
    if (!localLib) return;
    if (!(await confirmDelete(tab.name))) return;
    try {
      await deleteLocalTab(localLib, tab.path);
      setLocalTabs(await listLocalTabs(localLib));
      setMessage(`Deleted "${tab.name}" from this device.`);
    } catch (e) {
      setMessage(`Delete failed: ${String(e)}`);
    }
  };

  // In Tauri, downloads need a destination folder; the browser uses a normal download.
  const canDownload = !tauri || !!localLib;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Library</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <section className="modal__section">
          <button className="row-action" onClick={handleOpenFile}>
            <FileIcon />
            <div>
              <strong>Open a file</strong>
              <span>Guitar Pro, MusicXML, Capella or AlphaTex from this device</span>
            </div>
          </button>
        </section>

        {host && (
          <section className="modal__section">
            <h3>Share this device's library</h3>
            <button className="row-action" onClick={handlePickFolder} disabled={busy}>
              <FolderIcon />
              <div>
                <strong>{folder ? "Change shared folder" : "Choose a folder to share"}</strong>
                <span>{folder ?? "Serve a folder of tabs to your phone over Wi‑Fi"}</span>
              </div>
            </button>
            {serveUrl && (
              <div className="serve-url">
                On your phone, open <code>{serveUrl}</code> in this app and connect.
              </div>
            )}
          </section>
        )}

        <section className="modal__section">
          <h3>Connect to a library</h3>
          <div className="connect-row">
            <NetworkIcon />
            <input
              type="text"
              placeholder="http://192.168.1.50:8088"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
            <button className="btn btn--primary" onClick={handleConnect} disabled={busy || !remoteUrl}>
              Connect
            </button>
          </div>

          {tauri && (
            <div className="lib-dest">
              {localLib ? (
                <span>
                  Downloads save to <code>{localLib}</code>.{" "}
                  <button className="link-btn" onClick={handleSetupLibrary}>
                    {host ? "Change folder" : "Change"}
                  </button>
                </span>
              ) : (
                <span>
                  <button className="link-btn" onClick={handleSetupLibrary}>
                    {host ? "Choose a download folder" : "Set up phone library"}
                  </button>{" "}
                  to download tabs to this device.
                </span>
              )}
            </div>
          )}

          {remoteTabs.length > 0 && (
            <ul className="tab-list">
              {remoteTabs.map((t) => (
                <li key={t.path}>
                  <button className="tab-list__open" onClick={() => handleLoadRemote(t)} disabled={busy}>
                    <FileIcon />
                    <span>{t.name}</span>
                  </button>
                  <button
                    className="tab-list__dl"
                    onClick={() => handleDownload(t)}
                    disabled={!canDownload || downloading === t.path}
                    title={
                      canDownload
                        ? "Download to this device"
                        : "Set up a download folder first"
                    }
                    aria-label="Download to this device"
                  >
                    <DownloadIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {tauri && localLib && localTabs.length > 0 && (
          <section className="modal__section">
            <h3>On this device</h3>
            <ul className="tab-list">
              {localTabs.map((t) => (
                <li key={t.path}>
                  <button className="tab-list__open" onClick={() => handleLoadLocal(t)} disabled={busy}>
                    <FileIcon />
                    <span>{t.name}</span>
                  </button>
                  <button
                    className="tab-list__dl tab-list__del"
                    onClick={() => handleDeleteLocal(t)}
                    title="Delete from this device"
                    aria-label="Delete from this device"
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {message && <div className="modal__message">{message}</div>}
      </div>
    </div>
  );
}
