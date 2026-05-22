import { useCallback, useRef } from "react";
import type { AlphaTabController } from "../../lib/useAlphaTab";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  LoopIcon,
  MetronomeIcon,
  TimerIcon,
  BracketsIcon,
} from "../Icons";

interface Props {
  controller: AlphaTabController;
}

function formatTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Always-visible playback controls that hover over the score on mobile: a thin
// seek bar pinned above a bottom-center cluster (large play/stop, smaller
// loop / metronome / count-in / snap). The wrapper ignores pointer events so the
// score stays scrollable in the gaps; only the controls themselves are tappable.
export default function FloatingTransport({ controller }: Props) {
  const { state } = controller;
  const trackRef = useRef<HTMLDivElement>(null);
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

  if (disabled) return null;

  return (
    <div className="floating-transport" aria-hidden={disabled}>
      <div className="floating-cluster">
        <button
          className={`fab ${state.looping ? "fab--active" : ""}`}
          onClick={controller.toggleLoop}
          title="Loop"
        >
          <LoopIcon />
        </button>
        <button
          className={`fab ${state.metronome ? "fab--active" : ""}`}
          onClick={controller.toggleMetronome}
          title="Metronome"
        >
          <MetronomeIcon />
        </button>

        <button
          className="fab fab--lg fab--primary"
          onClick={controller.playPause}
          title="Play / Pause"
        >
          {state.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="fab fab--lg" onClick={controller.stop} title="Stop">
          <StopIcon />
        </button>

        <button
          className={`fab fab--countin ${state.countInMode > 0 ? "fab--active" : ""}`}
          onClick={controller.cycleCountIn}
          title="Count-in"
        >
          <TimerIcon />
          {state.countInMode === 2 && (
            <span className="countin-badge">
              <LoopIcon width={10} height={10} />
            </span>
          )}
        </button>
        <button
          className={`fab ${state.snapToBar ? "fab--active" : ""}`}
          onClick={controller.toggleSnapToBar}
          title="Snap loop to bars"
        >
          <BracketsIcon />
        </button>
      </div>

      <div className="floating-seek">
        <span className="floating-seek__time">{formatTime(state.currentTime)}</span>
        <div className="seekbar" ref={trackRef} onClick={onSeek} role="slider" aria-label="Seek">
          <div className="seekbar__fill" style={{ width: `${ratio * 100}%` }} />
          <div className="seekbar__thumb" style={{ left: `${ratio * 100}%` }} />
        </div>
        <span className="floating-seek__time">{formatTime(state.endTime)}</span>
      </div>
    </div>
  );
}
