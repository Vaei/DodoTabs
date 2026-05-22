import { useCallback, useEffect, useRef } from "react";
import type { AlphaTabController } from "../lib/useAlphaTab";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;

interface Props {
  controller: AlphaTabController;
  onOpenFile: () => void;
  mobile: boolean;
}

/**
 * The score area. The outer `.score-viewport` is the scroll element handed to
 * alphaTab (player.scrollElement); alphaTab renders into the inner `.score-surface`.
 */
export default function ScoreView({ controller, onOpenFile, mobile }: Props) {
  const { state, containerRef, viewportRef } = controller;

  // Two-finger pinch to change the zoom %. Browser viewport zoom is disabled on
  // mobile (so the UI can't be dragged), so we map the pinch to alphaTab's scale
  // ourselves. During the gesture we only preview with a CSS transform (no DOM
  // change, so the touch sequence keeps flowing); the real re-render runs once on
  // release.
  const setZoom = controller.setZoom;
  const zoomRef = useRef(state.zoom);
  zoomRef.current = state.zoom;
  const getZoom = useCallback(() => zoomRef.current, []);

  useEffect(() => {
    const el = viewportRef.current;
    const surface = containerRef.current;
    if (!el || !surface || !mobile) return;

    const round = (z: number) => Math.round(z * 100) / 100;
    const distance = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    let active = false;
    let startDist = 0;
    let startZoom = 1;
    let pending = 1;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      active = true;
      startDist = distance(e.touches);
      startZoom = getZoom();
      pending = startZoom;
      // Anchor the preview scale at the pinch midpoint within the score surface.
      const rect = surface.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      surface.style.transformOrigin = `${midX}px ${midY}px`;
      e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 2) return;
      e.preventDefault();
      const ratio = distance(e.touches) / (startDist || 1);
      pending = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, startZoom * ratio));
      surface.style.transform = `scale(${pending / startZoom})`;
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      surface.style.transform = "";
      surface.style.transformOrigin = "";
      if (round(pending) !== round(startZoom)) setZoom(round(pending));
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [viewportRef, containerRef, mobile, getZoom, setZoom]);

  return (
    <div className="score-area">
      <div className="score-viewport" ref={viewportRef}>
        <div className="score-surface" ref={containerRef} />
      </div>

      {!state.scoreLoaded && (
        <button
          type="button"
          className="score-empty"
          onClick={onOpenFile}
          title="Open a tab file"
        >
          <div className="score-empty__inner">
            <h2>No tab loaded</h2>
            <p>Click here to open a Guitar Pro / MusicXML file, or connect to a tab library on your network.</p>
          </div>
        </button>
      )}

      {state.rendering && state.scoreLoaded && (
        <div className="score-busy">Rendering…</div>
      )}

      {state.error && <div className="score-error">⚠ {state.error}</div>}
    </div>
  );
}
