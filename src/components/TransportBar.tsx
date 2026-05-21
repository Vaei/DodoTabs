import { useCallback, useRef } from "react";
import type { AlphaTabController } from "../lib/useAlphaTab";
import { ZOOMS } from "../lib/constants";
import SpeedControl from "./SpeedControl";
import BpmControl from "./BpmControl";
import { ChevronLeftIcon } from "./Icons";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  LoopIcon,
  MetronomeIcon,
  TimerIcon,
  LayoutIcon,
  CloseIcon,
  BracketsIcon,
  MicIcon,
} from "./Icons";

interface Props {
  controller: AlphaTabController;
  hotkeysVisible: boolean;
  onToggleHotkeys: () => void;
  syncEnabled: boolean;
  syncAvailable: boolean;
  onToggleSync: () => void;
  onOpenMic: () => void;
}

function formatTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TransportBar({
  controller,
  hotkeysVisible,
  onToggleHotkeys,
  syncEnabled,
  syncAvailable,
  onToggleSync,
  onOpenMic,
}: Props) {
  const { state } = controller;
  const trackRef = useRef<HTMLDivElement>(null);
  const hkVisible = hotkeysVisible;

  const ratio = state.endTime > 0 ? state.currentTime / state.endTime : 0;
  const disabled = !state.scoreLoaded;

  const onSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      controller.seekToRatio((e.clientX - rect.left) / rect.width);
    },
    [controller]
  );

  return (
    <footer className="transport">
      <div className="transport__seek">
        <span className="transport__time">{formatTime(state.currentTime)}</span>
        <div className="seekbar" ref={trackRef} onClick={onSeek} role="slider" aria-label="Seek">
          <div className="seekbar__fill" style={{ width: `${ratio * 100}%` }} />
          <div className="seekbar__thumb" style={{ left: `${ratio * 100}%` }} />
        </div>
        <span className="transport__time">{formatTime(state.endTime)}</span>
      </div>

      <div className="transport__controls">
        <div className="transport__group">
          <button
            className={`btn btn--wide ${syncEnabled && syncAvailable ? "btn--active" : ""}`}
            onClick={() => (syncAvailable ? onToggleSync() : onOpenMic())}
            title={
              syncAvailable
                ? "Sync to metronome: start playback (and each loop) on the beat"
                : "Open the metronome mic dialog and start listening"
            }
          >
            <MicIcon width={16} height={16} />
            <span>Sync</span>
          </button>
        </div>

        <div className="transport__group">
          <button
            className="btn btn--primary"
            onClick={controller.playPause}
            disabled={disabled}
            title="Play / Pause (Space)"
          >
            {state.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="btn" onClick={controller.stop} disabled={disabled} title="Stop (X)">
            <StopIcon />
          </button>
        </div>

        <div className="transport__group">
          <button
            className={`btn ${state.looping ? "btn--active" : ""}`}
            onClick={controller.toggleLoop}
            disabled={disabled}
            title={
              state.hasSelection
                ? "Looping selected section"
                : "Loop (drag on the score to loop a section)"
            }
          >
            <LoopIcon />
          </button>
          <button
            className={`btn ${state.metronome ? "btn--active" : ""}`}
            onClick={controller.toggleMetronome}
            disabled={disabled}
            title="Metronome (M)"
          >
            <MetronomeIcon />
          </button>
          <button
            className={`btn btn--countin ${state.countInMode > 0 ? "btn--active" : ""}`}
            onClick={controller.cycleCountIn}
            disabled={disabled}
            title={
              state.countInMode === 0
                ? "Count-in: off (Z)"
                : state.countInMode === 1
                  ? "Count-in: before playback (Z)"
                  : "Count-in: before every loop (Z)"
            }
          >
            <TimerIcon />
            {state.countInMode === 2 && (
              <span className="countin-badge">
                <LoopIcon width={11} height={11} />
              </span>
            )}
          </button>
          <button
            className={`btn ${state.snapToBar ? "btn--active" : ""}`}
            onClick={controller.toggleSnapToBar}
            disabled={disabled}
            title="Snap loop selection to whole bars"
          >
            <BracketsIcon />
          </button>

          {state.hasSelection && (
            <span className="sel-chip" title="Looping the highlighted section">
              <LoopIcon width={14} height={14} />
              Section
              <button
                className="sel-chip__clear"
                onClick={controller.clearSelection}
                aria-label="Clear looped section"
                title="Clear section (C)"
              >
                <CloseIcon width={14} height={14} />
              </button>
            </span>
          )}
        </div>

        <div className={`transport__hotkeys ${hkVisible ? "" : "transport__hotkeys--collapsed"}`}>
          <button
            className="hotkeys__toggle"
            onClick={onToggleHotkeys}
            title={hkVisible ? "Hide shortcuts (H)" : "Show shortcuts (H)"}
            aria-label={hkVisible ? "Hide shortcuts" : "Show shortcuts"}
          >
            <ChevronLeftIcon
              width={16}
              height={16}
              style={{ transform: hkVisible ? "none" : "rotate(180deg)" }}
            />
          </button>
          {hkVisible && (
            <div className="hotkeys__list" aria-hidden="true">
              <span>
                <kbd>Space</kbd> Play
              </span>
              <span>
                <kbd>X</kbd> Stop
              </span>
              <span>
                <kbd>C</kbd> Clear loop
              </span>
              <span>
                <kbd>Z</kbd> Count-in
              </span>
              <span>
                <kbd>M</kbd> Metronome
              </span>
              <span title="Shift+A / Shift+D - skip back / forward by seconds">
                <kbd>A</kbd>/<kbd>D</kbd> Bar
              </span>
              <span>
                <kbd>Ctrl</kbd>+Scroll Speed
              </span>
              <span>
                <kbd>Shift</kbd>+Scroll Zoom
              </span>
              <span>
                <kbd>Alt</kbd>+Scroll BPM
              </span>
            </div>
          )}
        </div>

        <div className="transport__group transport__group--selects">
          <SpeedControl value={state.speed} disabled={disabled} onChange={controller.setSpeed} />

          <BpmControl
            value={state.tempo > 0 ? Math.round(state.tempo * state.speed) : 0}
            resetTo={state.tempo}
            disabled={disabled || state.tempo <= 0}
            onChange={controller.setBpm}
          />

          <label
            className="select"
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                controller.setZoom(1); // middle-click resets to 100%
              }
            }}
          >
            <span>Zoom</span>
            <select
              value={state.zoom}
              disabled={disabled}
              onChange={(e) => controller.setZoom(Number(e.target.value))}
            >
              {ZOOMS.map((z) => (
                <option key={z} value={z}>
                  {Math.round(z * 100)}%
                </option>
              ))}
            </select>
          </label>

          <label className="select">
            <span>Layout</span>
            <button
              className="btn btn--wide btn--field"
              disabled={disabled}
              onClick={() => controller.setLayout(state.layout === "page" ? "horizontal" : "page")}
              title="Toggle page / scroll layout"
            >
              <LayoutIcon width={16} height={16} />
              <span>{state.layout === "page" ? "Page" : "Scroll"}</span>
            </button>
          </label>
        </div>
      </div>
    </footer>
  );
}
