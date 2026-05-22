import { useCallback, useEffect, useRef, useState } from "react";
import * as alphaTab from "@coderline/alphatab";
import type { LoadedFile } from "./runtime";
import { playCountIn } from "./countIn";

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
}

const OUTPUT_DEVICE_KEY = "dodotabs.outputDevice";
export const COUNT_IN_FULL_SPEED_KEY = "dodotabs.countInFullSpeed";

export interface TrackInfo {
  index: number;
  name: string;
  muted: boolean;
  soloed: boolean;
  volume: number; // 0..1
  rendered: boolean;
  activity: number; // 0..1 live playback level (which track is sounding now)
}

export interface AlphaTabState {
  ready: boolean;
  scoreLoaded: boolean;
  title: string;
  artist: string;
  tempo: number; // song's base tempo in BPM (0 until a score is loaded)
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
  // Sync is on and we're holding playback until the next metronome beat is heard.
  awaitingBeat: boolean;
  // Mobile two-tap loop selection is armed (tap a start beat, then an end beat).
  tapSelecting: boolean;
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
  tempo: 0,
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
  awaitingBeat: false,
  tapSelecting: false,
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
  play: () => void;
  playPause: () => void;
  stop: () => void;
  seekToRatio: (ratio: number) => void;
  skip: (seconds: number) => void;
  stepBar: (dir: -1 | 1) => void;
  setSpeed: (speed: number) => void;
  setBpm: (bpm: number) => void;
  toggleLoop: () => void;
  clearSelection: () => void;
  toggleTapSelect: () => void;
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
  setSyncDelay: (fn: (allowImmediate: boolean) => number | null | undefined) => void;
  setSyncLoop: (enabled: boolean) => void;
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
  // Mobile two-tap selection: armed flag + the first tapped (anchor) beat.
  const tapSelectRef = useRef(false);
  const tapAnchorRef = useRef<alphaTab.model.Beat | null>(null);
  // Count-in mode + whether a section is selected, for the manual loop count-in.
  const countInModeRef = useRef<0 | 1 | 2>(0);
  const hasSelectionRef = useRef(false);
  const playingRef = useRef(false);
  // Live per-track activity levels (track index -> 0..1), peaked on note onsets
  // and decayed by a timer for a bouncing-meter look. Driven from the audio
  // timeline across ALL tracks (not just rendered ones).
  const activityRef = useRef<Map<number, number>>(new Map());
  const allTrackIdsRef = useRef<Set<number>>(new Set());
  const lastBeatIdRef = useRef<Map<number, number>>(new Map());
  const findHintRef = useRef<unknown>(null);
  // Metronome-sync: when on, plays/loop-restarts are deferred to the next beat.
  const syncLoopRef = useRef(false);
  // Sync timing source (set by App): returns ms to delay the start so it lands on
  // the next metronome beat, `null` when sync is on but no beat has been heard yet
  // (so we wait), or `undefined` when sync is off (start immediately).
  const syncDelayRef = useRef<(allowImmediate: boolean) => number | null | undefined>(
    () => undefined
  );
  // Pending (not-yet-fired) sync-aligned start, so it can be cancelled on stop.
  const pendingStartRef = useRef<{ poll?: number; timer?: number }>({});
  // Cancels an in-progress custom (full-speed) count-in; see startWithCountIn.
  const countInCancelRef = useRef<(() => void) | null>(null);

  const patch = useCallback((p: Partial<AlphaTabState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const clearPendingStart = useCallback(() => {
    const p = pendingStartRef.current;
    if (p.poll != null) window.clearInterval(p.poll);
    if (p.timer != null) window.clearTimeout(p.timer);
    pendingStartRef.current = {};
    setState((s) => (s.awaitingBeat ? { ...s, awaitingBeat: false } : s));
  }, []);

  // Snap the cursor to the song's nearest beat boundary so the song's beat grid can
  // line up with the metronome (aligning only the start instant isn't enough if the
  // cursor sits mid-beat). Beat length is the bar's tick span / its beat count.
  const snapToBeat = useCallback(() => {
    const api = apiRef.current;
    const bars = api?.score?.masterBars;
    if (!api || !bars || bars.length === 0) return;
    const tick = api.tickPosition;
    let i = 0;
    while (i + 1 < bars.length && bars[i + 1].start <= tick) i++;
    const bar = bars[i];
    const barEnd = i + 1 < bars.length ? bars[i + 1].start : api.endTick;
    const beats = bar.timeSignatureNumerator || 4;
    const span = barEnd - bar.start;
    if (span <= 0 || beats <= 0) return;
    const ticksPerBeat = span / beats;
    const idx = Math.round((tick - bar.start) / ticksPerBeat);
    api.tickPosition = Math.round(bar.start + idx * ticksPerBeat);
  }, []);

  // Start playback, deferring to the metronome beat when sync is on. `snap` aligns
  // the cursor to a beat first (used for fresh plays, not loop restarts whose start
  // position is already fixed). If sync is on but no beat has been heard, we poll
  // until one arrives instead of starting unsynced.
  const scheduleStart = useCallback(
    (doStart: () => void, snap: boolean) => {
      clearPendingStart();
      const compute = syncDelayRef.current;
      // Loop restarts (snap == false) may fire immediately when on the beat; fresh
      // plays always wait for the next beat for a consistent landing.
      const allowImmediate = !snap;
      const first = compute(allowImmediate);
      if (first === undefined) {
        doStart(); // sync off: start immediately
        return;
      }
      if (snap) snapToBeat();
      const fire = () => {
        const delay = compute(allowImmediate);
        if (delay == null) return; // no beat yet: keep waiting
        clearPendingStart();
        pendingStartRef.current.timer = window.setTimeout(doStart, delay);
      };
      if (first == null) {
        patch({ awaitingBeat: true }); // sync on, no beat yet: hold and show a throbber
        pendingStartRef.current.poll = window.setInterval(fire, 100);
      } else {
        pendingStartRef.current.timer = window.setTimeout(doStart, first);
      }
    },
    [clearPendingStart, snapToBeat, patch]
  );

  // When a count-in is active and "count-in at full speed" is on at a slowed tempo,
  // alphaTab's own count-in would be dragged out (and racing it lets the song bleed
  // through). Instead silence alphaTab's count-in for this start, click out the bar
  // ourselves at full tempo, then start the song at the user's speed once the count-in
  // is fully over.
  const startWithCountIn = useCallback((start: () => void) => {
    countInCancelRef.current?.(); // cancel any prior in-progress count-in
    const api = apiRef.current;
    if (!api) {
      start();
      return;
    }
    const mode = countInModeRef.current;
    const fullSpeed = (localStorage.getItem(COUNT_IN_FULL_SPEED_KEY) ?? "1") !== "0";
    const bars = api.score?.masterBars;
    const tempo = api.score?.tempo ?? 0;
    const useCustom =
      fullSpeed && mode > 0 && api.playbackSpeed !== 1 && !!bars && bars.length > 0 && tempo > 0;

    if (!useCustom || !bars) {
      // Use alphaTab's own count-in; (re-)set its volume to match the mode in case a
      // prior custom count-in left it muted.
      api.countInVolume = mode > 0 ? 1 : 0;
      start();
      return;
    }

    const tick = api.tickPosition;
    let i = 0;
    while (i + 1 < bars.length && bars[i + 1].start <= tick) i++;
    const barEnd = i + 1 < bars.length ? bars[i + 1].start : api.endTick;
    const beats = bars[i].timeSignatureNumerator || 4;
    const intervalMs = (((barEnd - bars[i].start) / 960) * (60000 / tempo)) / beats;

    // Keep alphaTab's count-in muted for this start (our clicks are the count-in); the
    // next non-custom start re-enables it. Restoring it before start() would make
    // alphaTab add its own slow count-in on top of ours.
    api.countInVolume = 0;
    const finish = (play: boolean) => {
      countInCancelRef.current = null;
      if (play) start();
    };
    const cancelClicks = playCountIn(beats, intervalMs, () => finish(true));
    countInCancelRef.current = () => {
      cancelClicks();
      finish(false);
    };
  }, []);

  // Native (seamless) looping is used only for modes 0/1 with sync off. For count-in
  // mode 2, or when metronome-sync is on, we loop manually (see playerFinished) so a
  // count-in / beat-aligned restart can happen.
  const applyLooping = useCallback(() => {
    const api = apiRef.current;
    if (api) {
      api.isLooping =
        loopingRef.current && countInModeRef.current !== 2 && !syncLoopRef.current;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !viewportRef.current) return;

    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = "/font/";
    settings.core.logLevel = alphaTab.LogLevel.Warning;
    // Surface lyrics that older Guitar Pro files stored as "beat text" (only kicks in
    // when the track has no proper lyrics of its own).
    settings.importer.beatTextAsLyrics = true;
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
        activity: 0,
      }));
      autoLoopRef.current = false;
      // Track every track index (the audio plays them all) for the activity meters.
      allTrackIdsRef.current = new Set((score?.tracks ?? []).map((t) => t.index));
      lastBeatIdRef.current.clear();
      findHintRef.current = null;
      activityRef.current.clear();
      // Reset playback speed to 1.0x (BPM defaults to the tab's tempo).
      api.playbackSpeed = 1;
      patch({
        scoreLoaded: !!score,
        title: score?.title ?? "",
        artist: score?.artist ?? "",
        tempo: score?.tempo ?? 0,
        tracks,
        currentTime: 0,
        currentTick: 0,
        speed: 1,
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
    // Highlight a->b respecting the snap-to-bar toggle (used by two-tap selection,
    // which has no drag to extend through).
    const selectRange = (a: alphaTab.model.Beat, b: alphaTab.model.Beat) => {
      if (snapBarRef.current) {
        selectWholeBars(a, b);
        return;
      }
      const aFirst =
        a.voice.bar.index < b.voice.bar.index ||
        (a.voice.bar.index === b.voice.bar.index && a.index <= b.index);
      const first = aFirst ? a : b;
      const last = aFirst ? b : a;
      api.highlightPlaybackRange(first, last);
    };
    api.beatMouseDown.on((beat) => {
      // Mobile two-tap selection: first tap anchors the start, second sets the end.
      // alphaTab's own mouse-up applies whatever range we highlight here.
      if (tapSelectRef.current) {
        if (!tapAnchorRef.current) {
          tapAnchorRef.current = beat;
          selectRange(beat, beat);
        } else {
          selectRange(tapAnchorRef.current, beat);
          tapAnchorRef.current = null;
          tapSelectRef.current = false;
          patch({ tapSelecting: false });
        }
        return;
      }
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
      const playing = e.state === alphaTab.synth.PlayerState.Playing;
      playingRef.current = playing;
      if (!playing) {
        // Clear the live activity meters when playback isn't running.
        activityRef.current.clear();
        setState((s) => ({
          ...s,
          playing,
          tracks: s.tracks.some((t) => t.activity !== 0)
            ? s.tracks.map((t) => ({ ...t, activity: 0 }))
            : s.tracks,
        }));
      } else {
        patch({ playing });
      }
    });


    api.playerPositionChanged.on((e) => {
      patch({
        currentTime: e.currentTime,
        endTime: e.endTime,
        currentTick: e.currentTick,
        endTick: e.endTick,
      });

      // Activity meters: look up the beats sounding NOW across all tracks (the
      // audio plays every track, not just the rendered ones) and peak each track's
      // meter on a new beat onset (skip rests / empty beats).
      const cache = api.tickCache;
      const all = allTrackIdsRef.current;
      if (!cache || all.size === 0) return;
      const res = cache.findBeat(
        all,
        e.currentTick,
        findHintRef.current as Parameters<typeof cache.findBeat>[2]
      );
      findHintRef.current = res;
      if (!res) return;
      const m = activityRef.current;
      const last = lastBeatIdRef.current;
      for (const item of res.beatLookup.highlightedBeats) {
        const beat = item.beat;
        if (!beat || beat.isRest || !beat.notes || beat.notes.length === 0) continue;
        const ti = beat.voice?.bar?.staff?.track?.index;
        if (ti == null) continue;
        if (last.get(ti) !== beat.id) {
          last.set(ti, beat.id);
          const d = Math.min(beat.dynamics ?? 5, 7);
          const lvl = Math.max(0.3, Math.min(1, (d + 1) / 8));
          m.set(ti, Math.max(m.get(ti) ?? 0, lvl));
        }
      }
    });

    api.soundFontLoaded.on(() => patch({ soundFontReady: true }));

    // Manual loop restart, used for count-in-per-loop (mode 2) and/or metronome-sync.
    // The restart goes through the play scheduler so it can be aligned to the next beat.
    // A count-in plays only in mode 2; for modes 0/1 we suppress it on the restart.
    api.playerFinished.on(() => {
      if (!loopingRef.current) return;
      if (countInModeRef.current !== 2 && !syncLoopRef.current) return;
      scheduleStart(() => {
        const a = apiRef.current;
        if (!a) return;
        a.stop();
        // stop() places the cursor on the next animation frame; let it settle (while
        // Paused) before play() flips to Playing, else the cursor animates during count-in.
        requestAnimationFrame(() => {
          const a2 = apiRef.current;
          if (!a2) return;
          if (countInModeRef.current === 2) {
            startWithCountIn(() => a2.play());
          } else {
            const v = a2.countInVolume;
            a2.countInVolume = 0;
            a2.play();
            a2.countInVolume = v;
          }
        });
      }, false);
    });

    // Re-apply a previously chosen audio output device once the player is ready.
    api.playerReady.on(async () => {
      const saved = localStorage.getItem(OUTPUT_DEVICE_KEY);
      if (!saved) return;
      try {
        type Device = Parameters<typeof api.setOutputDevice>[0];
        await api.setOutputDevice({ deviceId: saved, label: "", isDefault: false } as Device);
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

  // Drive the per-track activity meters while playing: render the current peaks,
  // then decay them so each meter bounces and falls back after a note.
  useEffect(() => {
    if (!state.playing) return;
    const id = window.setInterval(() => {
      const m = activityRef.current;
      setState((s) => {
        const anySolo = s.tracks.some((t) => t.soloed);
        let changed = false;
        const tracks = s.tracks.map((t) => {
          let a = m.get(t.index) ?? 0;
          if (t.muted || (anySolo && !t.soloed)) a = 0;
          if (Math.abs(a - t.activity) > 0.001) {
            changed = true;
            return { ...t, activity: a };
          }
          return t;
        });
        return changed ? { ...s, tracks } : s;
      });
      // Decay for the next tick.
      for (const [k, v] of m) {
        const nv = v <= 0.04 ? 0 : v * 0.8;
        if (nv === 0) m.delete(k);
        else m.set(k, nv);
      }
    }, 45);
    return () => clearInterval(id);
  }, [state.playing]);

  const loadFile = useCallback((file: LoadedFile) => {
    patch({ error: null });
    apiRef.current?.load(file.data);
  }, [patch]);

  // Starting playback goes through the scheduler (so metronome-sync can delay it to
  // the next beat); pausing is always immediate.
  const play = useCallback(() => {
    scheduleStart(() => startWithCountIn(() => apiRef.current?.play()), true);
  }, [scheduleStart, startWithCountIn]);
  const playPause = useCallback(() => {
    if (playingRef.current) apiRef.current?.playPause();
    else scheduleStart(() => startWithCountIn(() => apiRef.current?.playPause()), true);
  }, [scheduleStart, startWithCountIn]);
  const stop = useCallback(() => {
    clearPendingStart(); // drop any pending sync-aligned start
    countInCancelRef.current?.(); // abort an in-progress full-speed count-in
    apiRef.current?.stop();
  }, [clearPendingStart]);

  const setSyncDelay = useCallback(
    (fn: (allowImmediate: boolean) => number | null | undefined) => {
      syncDelayRef.current = fn;
    },
    []
  );

  // Enable/disable beat-aligned looping (App turns this on when sync mode + listening).
  const setSyncLoop = useCallback((enabled: boolean) => {
    syncLoopRef.current = enabled;
    applyLooping();
  }, [applyLooping]);

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
    const clamped = Math.max(0.125, Math.min(8, speed));
    if (apiRef.current) apiRef.current.playbackSpeed = clamped;
    patch({ speed: clamped });
  }, [patch]);

  // BPM is a view over the speed: speed = targetBpm / songTempo.
  const setBpm = useCallback((bpm: number) => {
    const base = apiRef.current?.score?.tempo ?? 0;
    if (base > 0) setSpeed(bpm / base);
  }, [setSpeed]);

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

  // Arm / disarm the mobile two-tap loop selection.
  const toggleTapSelect = useCallback(() => {
    setState((s) => {
      const tapSelecting = !s.tapSelecting;
      tapSelectRef.current = tapSelecting;
      tapAnchorRef.current = null;
      return { ...s, tapSelecting };
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

  // Enumerate outputs via the standard mediaDevices API (the same one that works for
  // inputs). alphaTab's enumerateOutputDevices() comes back empty in this webview, so
  // we list here and hand alphaTab a constructed device for setSinkId in setOutputDevice.
  const listOutputDevices = useCallback(async (): Promise<AudioDeviceInfo[]> => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "audiooutput" && d.deviceId && d.deviceId !== "default")
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
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
    type Device = Parameters<typeof api.setOutputDevice>[0];
    await api.setOutputDevice({ deviceId, label: "", isDefault: false } as Device);
    localStorage.setItem(OUTPUT_DEVICE_KEY, deviceId);
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
    play,
    playPause,
    stop,
    seekToRatio,
    skip,
    stepBar,
    setSpeed,
    setBpm,
    toggleLoop,
    clearSelection,
    toggleTapSelect,
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
    setSyncDelay,
    setSyncLoop,
  };
}
