import { useCallback, useEffect, useRef, useState } from "react";
import { useAlphaTab } from "./lib/useAlphaTab";
import { useTempoSync } from "./lib/useTempoSync";
import { SPEEDS, ZOOMS, stepPreset } from "./lib/constants";
import ScoreView from "./components/ScoreView";
import TransportBar from "./components/TransportBar";
import TrackSidebar from "./components/TrackSidebar";
import RecentList from "./components/RecentList";
import LibraryPanel from "./components/LibraryPanel";
import FileMenu from "./components/FileMenu";
import AboutModal from "./components/AboutModal";
import SettingsModal from "./components/SettingsModal";
import TempoSyncModal from "./components/TempoSyncModal";
import { openLocalFile, type LoadedFile, type TabSource } from "./lib/runtime";
import { useFileDrop } from "./lib/useFileDrop";
import {
  type RecentEntry,
  addRecent,
  clearRecents as clearRecentsStore,
  loadRecents,
  reopenRecent,
} from "./lib/recents";
import { FolderIcon, MicIcon } from "./components/Icons";

function keyOf(source: TabSource): string | null {
  if (source.kind === "localPath") return `local:${source.path}`;
  if (source.kind === "remote") return `remote:${source.baseUrl}|${source.path}`;
  return null;
}

export default function App() {
  const controller = useAlphaTab();
  const { state } = controller;
  const tempoSync = useTempoSync(controller);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tempoOpen, setTempoOpen] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>(() => loadRecents());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hotkeysVisible, setHotkeysVisible] = useState(
    () => localStorage.getItem("dodotabs.hotkeys") !== "0"
  );
  const [skipSeconds, setSkipSeconds] = useState(() => {
    const v = Number.parseFloat(localStorage.getItem("dodotabs.skipSeconds") ?? "");
    return Number.isFinite(v) && v > 0 ? v : 3;
  });

  const changeSkipSeconds = useCallback((v: number) => {
    const val = Math.max(0.5, Math.min(60, v));
    localStorage.setItem("dodotabs.skipSeconds", String(val));
    setSkipSeconds(val);
  }, []);

  const [bpmStep, setBpmStep] = useState(() => {
    const v = Number.parseFloat(localStorage.getItem("dodotabs.bpmStep") ?? "");
    return Number.isFinite(v) && v > 0 ? v : 1;
  });

  const changeBpmStep = useCallback((v: number) => {
    const val = Math.max(0.5, Math.min(20, v));
    localStorage.setItem("dodotabs.bpmStep", String(val));
    setBpmStep(val);
  }, []);

  const toggleHotkeys = useCallback(() => {
    setHotkeysVisible((v) => {
      const next = !v;
      localStorage.setItem("dodotabs.hotkeys", next ? "1" : "0");
      return next;
    });
  }, []);

  // Latest state for use inside non-reactive window event handlers (wheel).
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastWheelRef = useRef(0);

  const handleOpen = useCallback(
    (file: LoadedFile) => {
      controller.loadFile(file);
      setRecents(addRecent(file));
      setActiveKey(keyOf(file.source));
    },
    [controller]
  );

  const quickOpen = useCallback(async () => {
    const file = await openLocalFile();
    if (file) handleOpen(file);
  }, [handleOpen]);

  const dragging = useFileDrop(handleOpen);

  const openRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        handleOpen(await reopenRecent(entry));
      } catch {
        setNotice(`Couldn't open "${entry.name}" - it may have moved or the library is offline.`);
      }
    },
    [handleOpen]
  );

  const clearRecents = useCallback(() => setRecents(clearRecentsStore()), []);

  // Auto-dismiss the notice toast.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  // Ctrl/Cmd + wheel = speed presets; Shift + wheel = zoom presets; Alt + wheel = BPM.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const accel = e.ctrlKey || e.metaKey;
      if (!accel && !e.shiftKey && !e.altKey) return;
      e.preventDefault(); // suppress browser/page zoom and horizontal scroll
      const s = stateRef.current;
      if (!s.scoreLoaded) return;
      const now = performance.now();
      if (now - lastWheelRef.current < 90) return; // one notch = one step
      lastWheelRef.current = now;
      const dir = e.deltaY < 0 ? 1 : -1;
      if (accel) {
        controller.setSpeed(stepPreset(s.speed, SPEEDS, dir));
      } else if (e.altKey) {
        if (s.tempo > 0) controller.setBpm(Math.round(s.tempo * s.speed) + dir * bpmStep);
      } else {
        controller.setZoom(stepPreset(s.zoom, ZOOMS, dir));
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [controller, bpmStep]);

  // Metronome sync: when enabled and listening, route playback starts (and loop
  // restarts) to begin on the next detected beat.
  const { setPlayScheduler, setSyncLoop } = controller;
  const { msToNextBeat } = tempoSync;
  const listening = tempoSync.state.listening;
  useEffect(() => {
    const active = syncEnabled && listening;
    setPlayScheduler((doPlay) => {
      if (active) {
        const delay = msToNextBeat();
        if (delay != null) {
          window.setTimeout(doPlay, delay);
          return;
        }
      }
      doPlay();
    });
    setSyncLoop(active);
  }, [setPlayScheduler, setSyncLoop, msToNextBeat, syncEnabled, listening]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /INPUT|SELECT|TEXTAREA/.test(target.tagName);

      // While a modal is open, Escape closes it and other shortcuts are suppressed.
      if (libraryOpen || settingsOpen || aboutOpen || tempoOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setLibraryOpen(false);
          setSettingsOpen(false);
          setAboutOpen(false);
          setTempoOpen(false);
        }
        return;
      }

      // Ctrl/Cmd combos (work regardless of focus).
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "o") {
          e.preventDefault();
          void quickOpen();
        } else if (k === "l") {
          e.preventDefault();
          setLibraryOpen(true);
        } else if (k === "s") {
          e.preventDefault();
          setSettingsOpen(true);
        }
        return;
      }

      if (typing) return;

      const k = e.key.toLowerCase();
      if (k === "h") {
        e.preventDefault();
        toggleHotkeys();
      } else if (e.code === "Space") {
        e.preventDefault();
        if (state.scoreLoaded) controller.playPause();
      } else if (k === "x") {
        e.preventDefault();
        if (state.scoreLoaded) controller.stop();
      } else if (k === "c") {
        e.preventDefault();
        if (state.hasSelection) controller.clearSelection();
      } else if (k === "z") {
        e.preventDefault();
        if (state.scoreLoaded) controller.cycleCountIn();
      } else if (k === "m") {
        e.preventDefault();
        if (state.scoreLoaded) controller.toggleMetronome();
      } else if (k === "b") {
        e.preventDefault();
        if (state.scoreLoaded) {
          controller.setLayout(state.layout === "page" ? "horizontal" : "page");
        }
      } else if (k === "a") {
        e.preventDefault();
        if (state.scoreLoaded) {
          if (e.shiftKey) controller.skip(-skipSeconds);
          else controller.stepBar(-1);
        }
      } else if (k === "d") {
        e.preventDefault();
        if (state.scoreLoaded) {
          if (e.shiftKey) controller.skip(skipSeconds);
          else controller.stepBar(1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    controller,
    state.scoreLoaded,
    state.hasSelection,
    state.layout,
    skipSeconds,
    quickOpen,
    toggleHotkeys,
    libraryOpen,
    settingsOpen,
    aboutOpen,
    tempoOpen,
  ]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">🦤</span>
          <span className="brand__name">DodoTabs</span>
        </div>

        <nav className="menubar">
          <FileMenu
            recents={recents}
            onOpenFile={quickOpen}
            onOpenLibrary={() => setLibraryOpen(true)}
            onOpenRecent={openRecent}
          />
          <button className="btn btn--ghost menubar-item" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button className="btn btn--ghost menubar-item" onClick={() => setAboutOpen(true)}>
            About
          </button>
        </nav>

        <div className="topbar__title">
          {state.scoreLoaded ? (
            <>
              <strong>{state.title || "Untitled"}</strong>
              {state.artist && <span>{state.artist}</span>}
            </>
          ) : (
            <span className="topbar__hint">Load a tab to begin</span>
          )}
        </div>

        <div className="topbar__actions">
          {!state.soundFontReady && state.scoreLoaded && (
            <span className="topbar__loading">loading sounds…</span>
          )}
          <button
            className={`btn ${tempoSync.state.listening ? "btn--active" : ""}`}
            onClick={() => setTempoOpen(true)}
            title="Play in time with a metronome (mic)"
          >
            <MicIcon />
          </button>
          <button className="btn btn--primary" onClick={() => setLibraryOpen(true)}>
            <FolderIcon />
            <span>Library</span>
          </button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          <TrackSidebar controller={controller} />
          <RecentList
            recents={recents}
            activeKey={activeKey}
            onOpen={openRecent}
            onClear={clearRecents}
          />
        </aside>
        <ScoreView controller={controller} />
      </div>

      <TransportBar
        controller={controller}
        hotkeysVisible={hotkeysVisible}
        onToggleHotkeys={toggleHotkeys}
        syncEnabled={syncEnabled}
        syncAvailable={listening}
        onToggleSync={() => setSyncEnabled((v) => !v)}
        onOpenMic={() => setTempoOpen(true)}
      />

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay__inner">Drop a tab file to open</div>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}

      {libraryOpen && (
        <LibraryPanel onLoad={handleOpen} onClose={() => setLibraryOpen(false)} />
      )}

      {settingsOpen && (
        <SettingsModal
          controller={controller}
          skipSeconds={skipSeconds}
          onChangeSkipSeconds={changeSkipSeconds}
          bpmStep={bpmStep}
          onChangeBpmStep={changeBpmStep}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}

      {tempoOpen && <TempoSyncModal sync={tempoSync} onClose={() => setTempoOpen(false)} />}
    </div>
  );
}
