import { useCallback, useEffect, useRef, useState } from "react";
import * as alphaTab from "@coderline/alphatab";
import type { LoadedFile } from "./runtime";

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
}

const OUTPUT_DEVICE_KEY = "dodotabs.outputDevice";

export interface TrackInfo {
  index: number;
  name: string;
  muted: boolean;
  soloed: boolean;
  volume: number; // 0..1
  rendered: boolean;
}

export interface AlphaTabState {
  ready: boolean;
  scoreLoaded: boolean;
  title: string;
  artist: string;
  tracks: TrackInfo[];
  playing: boolean;
  currentTime: number; // ms
  endTime: number; // ms
  currentTick: number;
  endTick: number;
  rendering: boolean;
  soundFontReady: boolean;
  speed: number;
  looping: boolean;
  hasSelection: boolean;
  snapToBar: boolean;
  metronome: boolean;
  // Count-in: 0 = off, 1 = once before playback, 2 = before every loop of a section
  // (mode 2 is only reachable while a section is selected).
  countInMode: 0 | 1 | 2;
  zoom: number;
  layout: "page" | "horizontal";
  error: string | null;
}

const initialState: AlphaTabState = {
  ready: false,
  scoreLoaded: false,
  title: "",
  artist: "",
  tracks: [],
  playing: false,
  currentTime: 0,
  endTime: 0,
  currentTick: 0,
  endTick: 0,
  rendering: false,
  soundFontReady: false,
  speed: 1,
  looping: false,
  hasSelection: false,
  snapToBar: false,
  metronome: false,
  countInMode: 0,
  zoom: 1,
  layout: "page",
  error: null,
};

export interface AlphaTabController {
  state: AlphaTabState;
  containerRef: React.RefObject<HTMLDivElement>;
  viewportRef: React.RefObject<HTMLDivElement>;
  loadFile: (file: LoadedFile) => void;
  playPause: () => void;
  stop: () => void;
  seekToRatio: (ratio: number) => void;
  skip: (seconds: number) => void;
  stepBar: (dir: -1 | 1) => void;
  setSpeed: (speed: number) => void;
  toggleLoop: () => void;
  clearSelection: () => void;
  toggleSnapToBar: () => void;
  toggleMetronome: () => void;
  cycleCountIn: () => void;
  listOutputDevices: () => Promise<AudioDeviceInfo[]>;
  setOutputDevice: (deviceId: string | null) => Promise<void>;
  setZoom: (zoom: number) => void;
  setLayout: (layout: "page" | "horizontal") => void;
  setTrackMute: (index: number, muted: boolean) => void;
  setTrackSolo: (index: number, soloed: boolean) => void;
  setTrackVolume: (index: number, volume: number) => void;
  renderTracks: (indexes: number[]) => void;
}

export function useAlphaTab(): AlphaTabController {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const [state, setState] = useState<AlphaTabState>(initialState);
  // Mirror loop state for use inside non-reactive event handlers; track whether the
  // current loop was turned on automatically by making a selection (vs. manually).
  const loopingRef = useRef(false);
  const autoLoopRef = useRef(false);
  // "Snap to bar" mode: expand drag-selection to whole-bar boundaries.
  const snapBarRef = useRef(false);
  const dragStartBeatRef = useRef<alphaTab.model.Beat | null>(null);
  // Count-in mode + whether a section is selected, for the manual loop count-in.
  const countInModeRef = useRef<0 | 1 | 2>(0);
  const hasSelectionRef = useRef(false);

  const patch = useCallback((p: Partial<AlphaTabState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  // Native looping is used for modes 0/1 (seamless). For mode 2 we loop manually
  // (see playerFinished) so a count-in can play before each repeat.
  const applyLooping = useCallback(() => {
    const api = apiRef.current;
    if (api) api.isLooping = loopingRef.current && countInModeRef.current !== 2;
  }, []);

  useEffect(() => {
    if (!containerRef.current || !viewportRef.current) return;

    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = "/font/";
    settings.core.logLevel = alphaTab.LogLevel.Warning;
    settings.display.layoutMode = alphaTab.LayoutMode.Page;
    settings.display.scale = 1;

    // Render notation in light ink for the dark themed sheet.
    const res = settings.display.resources;
    const light = (a = 0xff) => new alphaTab.model.Color(233, 235, 239, a);
    res.mainGlyphColor = light();
    res.secondaryGlyphColor = light(150);
    res.scoreInfoColor = light();
    res.staffLineColor = new alphaTab.model.Color(120, 127, 138, 0xff);
    res.barSeparatorColor = new alphaTab.model.Color(150, 157, 168, 0xff);
    res.barNumberColor = new alphaTab.model.Color(0xff, 0x8a, 0x3d, 0xff);

    settings.player.playerMode = alphaTab.PlayerMode.EnabledAutomatic;
    settings.player.soundFont = "/soundfont/sonivox.sf2";
    settings.player.scrollElement = viewportRef.current;
    settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
    settings.player.enableCursor = true;
    settings.player.enableUserInteraction = true;

    const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
    apiRef.current = api;
    patch({ ready: true });

    api.scoreLoaded.on((score) => {
      const tracks: TrackInfo[] = (score?.tracks ?? []).map((t) => ({
        index: t.index,
        name: t.name && t.name.length > 0 ? t.name : `Track ${t.index + 1}`,
        muted: false,
        soloed: false,
        volume: 1,
        rendered: true,
      }));
      autoLoopRef.current = false;
      patch({
        scoreLoaded: !!score,
        title: score?.title ?? "",
        artist: score?.artist ?? "",
        tracks,
        currentTime: 0,
        currentTick: 0,
        hasSelection: false,
      });
    });

    // Drag-selecting a section on the score sets a playback range (alphaTab built-in).
    // Reflect it, and auto-enable looping so "select a section" loops it in one gesture.
    api.playbackRangeChanged.on((e) => {
      const range = e.playbackRange;
      const has = !!range && range.endTick > range.startTick;
      hasSelectionRef.current = has;
      if (has && !loopingRef.current) {
        loopingRef.current = true;
        autoLoopRef.current = true;
        patch({ looping: true });
      } else if (!has && autoLoopRef.current) {
        loopingRef.current = false;
        autoLoopRef.current = false;
        patch({ looping: false });
      }
      // Count-in mode 2 requires a selection; downgrade to "once" when it's gone.
      if (!has && countInModeRef.current === 2) {
        countInModeRef.current = 1;
        patch({ countInMode: 1 });
      }
      applyLooping();
      patch({ hasSelection: has });
    });

    // When "snap to bar" is on, expand the drag-selection to cover whole bars.
    // alphaTab's own handlers run first (beat-level); we then override the highlight
    // to bar boundaries, which its mouse-up applies as the playback range.
    const selectWholeBars = (a: alphaTab.model.Beat, b: alphaTab.model.Beat) => {
      const aFirst = a.voice.bar.index <= b.voice.bar.index;
      const lower = aFirst ? a : b;
      const higher = aFirst ? b : a;
      const first = lower.voice.beats[0];
      const last = higher.voice.beats[higher.voice.beats.length - 1];
      if (first && last) api.highlightPlaybackRange(first, last);
    };
    api.beatMouseDown.on((beat) => {
      if (!snapBarRef.current) return;
      dragStartBeatRef.current = beat;
      selectWholeBars(beat, beat);
    });
    api.beatMouseMove.on((beat) => {
      if (!snapBarRef.current || !dragStartBeatRef.current) return;
      selectWholeBars(dragStartBeatRef.current, beat);
    });
    api.beatMouseUp.on(() => {
      dragStartBeatRef.current = null;
    });

    api.renderStarted.on(() => patch({ rendering: true }));
    api.renderFinished.on(() => patch({ rendering: false }));

    api.playerStateChanged.on((e) => {
      patch({ playing: e.state === alphaTab.synth.PlayerState.Playing });
    });

    api.playerPositionChanged.on((e) => {
      patch({
        currentTime: e.currentTime,
        endTime: e.endTime,
        currentTick: e.currentTick,
        endTick: e.endTick,
      });
    });

    api.soundFontLoaded.on(() => patch({ soundFontReady: true }));

    // Mode 2: re-arm the section loop with a count-in each time it finishes.
    // stop() parks the cursor at the range start, but its cursor placement runs on the
    // next animation frame - so we must let that frame run (while still Paused) before
    // play() flips the state to Playing, otherwise the cursor animates during the count-in.
    api.playerFinished.on(() => {
      if (
        loopingRef.current &&
        countInModeRef.current === 2 &&
        hasSelectionRef.current &&
        api.playbackRange
      ) {
        api.stop();
        requestAnimationFrame(() => apiRef.current?.play());
      }
    });

    // Re-apply a previously chosen audio output device once the player is ready.
    api.playerReady.on(async () => {
      const saved = localStorage.getItem(OUTPUT_DEVICE_KEY);
      if (!saved) return;
      try {
        const devices = await api.enumerateOutputDevices();
        const match = devices.find((d) => d.deviceId === saved);
        if (match) await api.setOutputDevice(match);
      } catch {
        /* output device selection unsupported on this platform */
      }
    });

    api.error.on((error) => {
      patch({ error: String((error as { message?: string })?.message ?? error) });
    });

    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFile = useCallback((file: LoadedFile) => {
    patch({ error: null });
    apiRef.current?.load(file.data);
  }, [patch]);

  const playPause = useCallback(() => apiRef.current?.playPause(), []);
  const stop = useCallback(() => apiRef.current?.stop(), []);

  const seekToRatio = useCallback((ratio: number) => {
    const api = apiRef.current;
    if (!api) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    api.tickPosition = Math.floor(clamped * api.endTick);
  }, []);

  // Skip playback by a number of seconds (negative = back).
  const skip = useCallback((seconds: number) => {
    const api = apiRef.current;
    if (!api) return;
    api.timePosition = Math.max(0, Math.min(api.endTime, api.timePosition + seconds * 1000));
  }, []);

  // Move the cursor to the previous (-1) / next (+1) bar line.
  const stepBar = useCallback((dir: -1 | 1) => {
    const api = apiRef.current;
    const bars = api?.score?.masterBars;
    if (!api || !bars || bars.length === 0) return;
    const tick = api.tickPosition;
    const eps = 5; // tolerance so being a hair into a bar still snaps to its start
    let target = bars[0].start;
    if (dir < 0) {
      for (const b of bars) {
        if (b.start < tick - eps) target = b.start;
        else break;
      }
    } else {
      target = bars[bars.length - 1].start;
      for (const b of bars) {
        if (b.start > tick + eps) {
          target = b.start;
          break;
        }
      }
    }
    api.tickPosition = target;
  }, []);

  const setSpeed = useCallback((speed: number) => {
    if (apiRef.current) apiRef.current.playbackSpeed = speed;
    patch({ speed });
  }, [patch]);

  const toggleLoop = useCallback(() => {
    setState((s) => {
      const looping = !s.looping;
      loopingRef.current = looping;
      autoLoopRef.current = false; // explicit user choice overrides selection auto-loop
      applyLooping();
      return { ...s, looping };
    });
  }, [applyLooping]);

  // Clear the looped section. Setting playbackRange to null also clears the
  // on-score highlight (the setter calls the internal selection update).
  const clearSelection = useCallback(() => {
    if (apiRef.current) apiRef.current.playbackRange = null;
  }, []);

  const toggleSnapToBar = useCallback(() => {
    setState((s) => {
      const snapToBar = !s.snapToBar;
      snapBarRef.current = snapToBar;
      return { ...s, snapToBar };
    });
  }, []);

  const toggleMetronome = useCallback(() => {
    setState((s) => {
      const metronome = !s.metronome;
      if (apiRef.current) apiRef.current.metronomeVolume = metronome ? 1 : 0;
      return { ...s, metronome };
    });
  }, []);

  // Cycle 0 → 1 → (2 if a section is selected) → 0.
  const cycleCountIn = useCallback(() => {
    setState((s) => {
      const canLoopCountIn = hasSelectionRef.current;
      let mode: 0 | 1 | 2;
      if (s.countInMode === 0) mode = 1;
      else if (s.countInMode === 1) mode = canLoopCountIn ? 2 : 0;
      else mode = 0;
      countInModeRef.current = mode;
      if (apiRef.current) apiRef.current.countInVolume = mode > 0 ? 1 : 0;
      applyLooping();
      return { ...s, countInMode: mode };
    });
  }, [applyLooping]);

  const listOutputDevices = useCallback(async (): Promise<AudioDeviceInfo[]> => {
    const api = apiRef.current;
    if (!api) return [];
    try {
      const devices = await api.enumerateOutputDevices();
      return devices.map((d) => ({ deviceId: d.deviceId, label: d.label }));
    } catch {
      return [];
    }
  }, []);

  const setOutputDevice = useCallback(async (deviceId: string | null) => {
    const api = apiRef.current;
    if (!api) return;
    if (!deviceId) {
      localStorage.removeItem(OUTPUT_DEVICE_KEY);
      await api.setOutputDevice(null);
      return;
    }
    const devices = await api.enumerateOutputDevices();
    const match = devices.find((d) => d.deviceId === deviceId) ?? null;
    await api.setOutputDevice(match);
    if (match) localStorage.setItem(OUTPUT_DEVICE_KEY, deviceId);
  }, []);

  const setZoom = useCallback((zoom: number) => {
    const api = apiRef.current;
    if (api) {
      api.settings.display.scale = zoom;
      api.updateSettings();
      api.render();
    }
    patch({ zoom });
  }, [patch]);

  const setLayout = useCallback((layout: "page" | "horizontal") => {
    const api = apiRef.current;
    if (api) {
      api.settings.display.layoutMode =
        layout === "page" ? alphaTab.LayoutMode.Page : alphaTab.LayoutMode.Horizontal;
      api.updateSettings();
      api.render();
    }
    patch({ layout });
  }, [patch]);

  const trackByIndex = useCallback((index: number) => {
    return apiRef.current?.score?.tracks.find((t) => t.index === index);
  }, []);

  const setTrackMute = useCallback((index: number, muted: boolean) => {
    const track = trackByIndex(index);
    if (track) apiRef.current?.changeTrackMute([track], muted);
    setState((s) => ({
      ...s,
      tracks: s.tracks.map((t) => (t.index === index ? { ...t, muted } : t)),
    }));
  }, [trackByIndex]);

  const setTrackSolo = useCallback((index: number, soloed: boolean) => {
    const track = trackByIndex(index);
    if (track) apiRef.current?.changeTrackSolo([track], soloed);
    setState((s) => ({
      ...s,
      tracks: s.tracks.map((t) => (t.index === index ? { ...t, soloed } : t)),
    }));
  }, [trackByIndex]);

  const setTrackVolume = useCallback((index: number, volume: number) => {
    const track = trackByIndex(index);
    if (track) apiRef.current?.changeTrackVolume([track], volume);
    setState((s) => ({
      ...s,
      tracks: s.tracks.map((t) => (t.index === index ? { ...t, volume } : t)),
    }));
  }, [trackByIndex]);

  const renderTracks = useCallback((indexes: number[]) => {
    const api = apiRef.current;
    if (!api?.score) return;
    const set = new Set(indexes);
    const tracks = api.score.tracks.filter((t) => set.has(t.index));
    if (tracks.length === 0) return;
    api.renderTracks(tracks);
    setState((s) => ({
      ...s,
      tracks: s.tracks.map((t) => ({ ...t, rendered: set.has(t.index) })),
    }));
  }, []);

  return {
    state,
    containerRef,
    viewportRef,
    loadFile,
    playPause,
    stop,
    seekToRatio,
    skip,
    stepBar,
    setSpeed,
    toggleLoop,
    clearSelection,
    toggleSnapToBar,
    toggleMetronome,
    cycleCountIn,
    listOutputDevices,
    setOutputDevice,
    setZoom,
    setLayout,
    setTrackMute,
    setTrackSolo,
    setTrackVolume,
    renderTracks,
  };
}
