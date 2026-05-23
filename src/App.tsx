import { useCallback, useEffect, useRef, useState } from "react";
import { useAlphaTab } from "./lib/useAlphaTab";
import { useTempoSync } from "./lib/useTempoSync";
import { AUTO_LOAD_LAST_KEY, METRONOME_SYNC, SPEEDS, ZOOMS, stepPreset } from "./lib/constants";
import ScoreView from "./components/ScoreView";
import TransportBar from "./components/TransportBar";
import TrackSidebar from "./components/TrackSidebar";
import RecentList from "./components/RecentList";
import LibraryPanel from "./components/LibraryPanel";
import FileMenu from "./components/FileMenu";
import AboutModal from "./components/AboutModal";
import SettingsModal from "./components/SettingsModal";
import TempoSyncModal from "./components/TempoSyncModal";
import LeftDrawer from "./components/mobile/LeftDrawer";
import BottomDrawer from "./components/mobile/BottomDrawer";
import FloatingTransport from "./components/mobile/FloatingTransport";
import TopDrawer from "./components/mobile/TopDrawer";
import TracksDrawer from "./components/mobile/TracksDrawer";
import { openLocalFile, type LoadedFile, type TabSource } from "./lib/runtime";
import { useMobile } from "./lib/useMobile";
import { useKeepAwake } from "./lib/useKeepAwake";
import { useFileDrop } from "./lib/useFileDrop";
import {
  type RecentEntry,
  addRecent,
  clearRecents as clearRecentsStore,
  removeRecent as removeRecentStore,
  loadRecents,
  reopenRecent,
} from "./lib/recents";
import { FolderIcon, MicIcon, CloseIcon } from "./components/Icons";

function keyOf(source: TabSource): string | null {
  if (source.kind === "localPath") return `local:${source.path}`;
  if (source.kind === "remote") return `remote:${source.baseUrl}|${source.path}`;
  return null;
}

export default function App() {
  const controller = useAlphaTab();
  const { state } = controller;
  const tempoSync = useTempoSync(controller);
  const mobile = useMobile();
  useKeepAwake(state.playing); // hold a screen wake lock while playing (if enabled)
  const [leftOpen, setLeftOpen] = useState(false);
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

  // Auto-load the most recently opened tab on startup (on by default).
  const didAutoLoadRef = useRef(false);
  useEffect(() => {
    if (didAutoLoadRef.current) return;
    didAutoLoadRef.current = true;
    if ((localStorage.getItem(AUTO_LOAD_LAST_KEY) ?? "1") === "0") return;
    const last = loadRecents()[0];
    if (last) openRecent(last);
  }, [openRecent]);

  const clearRecents = useCallback(() => setRecents(clearRecentsStore()), []);

  const removeRecent = useCallback(
    (entry: RecentEntry) => setRecents(removeRecentStore(entry)),
    []
  );

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

  // Metronome sync: when enabled and listening, supply the delay that aligns each
  // start (and loop restart) to the next detected beat. Returns the ms delay, null
  // when sync is on but no beat has been heard yet (the controller then waits), or
  // undefined when sync is off (start immediately).
  const { setSyncDelay, setSyncLoop } = controller;
  const { msToNextBeat } = tempoSync;
  const listening = tempoSync.state.listening;
  useEffect(() => {
    const active = syncEnabled && listening;
    setSyncDelay((allowImmediate) => (active ? msToNextBeat(allowImmediate) : undefined));
    setSyncLoop(active);
  }, [setSyncDelay, setSyncLoop, msToNextBeat, syncEnabled, listening]);

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
    <div className={`app ${mobile ? "app--mobile" : ""}`}>
      {mobile && (
        <TopDrawer
          title={state.title}
          artist={state.artist}
          scoreLoaded={state.scoreLoaded}
          micActive={tempoSync.state.listening}
          recents={recents}
          onOpenFile={quickOpen}
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenRecent={openRecent}
          onOpenRecents={() => setLeftOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAbout={() => setAboutOpen(true)}
          onOpenMic={() => setTempoOpen(true)}
        />
      )}

      {!mobile && (
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
          {METRONOME_SYNC && (
            <button
              className={`btn ${tempoSync.state.listening ? "btn--active" : ""}`}
              onClick={() => setTempoOpen(true)}
              title="Play in time with a metronome (mic)"
            >
              <MicIcon />
            </button>
          )}
          <button className="btn btn--primary" onClick={() => setLibraryOpen(true)}>
            <FolderIcon />
            <span>Library</span>
          </button>
        </div>
        </header>
      )}

      <div className="main">
        {mobile ? (
          <TracksDrawer controller={controller} />
        ) : (
          <aside className="sidebar">
            <TrackSidebar controller={controller} />
            <RecentList
              recents={recents}
              activeKey={activeKey}
              onOpen={openRecent}
              onRemove={removeRecent}
              onClear={clearRecents}
            />
          </aside>
        )}
        <ScoreView
          controller={controller}
          onOpenFile={quickOpen}
          onOpenLibrary={() => setLibraryOpen(true)}
          mobile={mobile}
        />
      </div>

      {mobile ? (
        <>
          <FloatingTransport controller={controller} />
          <BottomDrawer
            controller={controller}
            syncEnabled={syncEnabled}
            syncAvailable={listening}
            onToggleSync={() => setSyncEnabled((v) => !v)}
            onOpenMic={() => setTempoOpen(true)}
          />
          <LeftDrawer
            open={leftOpen}
            onClose={() => setLeftOpen(false)}
            recents={recents}
            activeKey={activeKey}
            onOpen={openRecent}
            onRemove={removeRecent}
            onClear={clearRecents}
          />
        </>
      ) : (
        <TransportBar
          controller={controller}
          hotkeysVisible={hotkeysVisible}
          onToggleHotkeys={toggleHotkeys}
          syncEnabled={syncEnabled}
          syncAvailable={listening}
          onToggleSync={() => setSyncEnabled((v) => !v)}
          onOpenMic={() => setTempoOpen(true)}
        />
      )}

      {mobile && state.tapSelecting && (
        <div className="tap-hint">
          <span>Tap the start beat, then the end beat</span>
          <button onClick={controller.toggleTapSelect} aria-label="Cancel section select">
            <CloseIcon width={16} height={16} />
          </button>
        </div>
      )}

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

      {METRONOME_SYNC && tempoOpen && (
        <TempoSyncModal sync={tempoSync} onClose={() => setTempoOpen(false)} />
      )}
    </div>
  );
}
