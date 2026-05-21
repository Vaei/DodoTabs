import type { AlphaTabController } from "../lib/useAlphaTab";

interface Props {
  controller: AlphaTabController;
}

/**
 * The score area. The outer `.score-viewport` is the scroll element handed to
 * alphaTab (player.scrollElement); alphaTab renders into the inner `.score-surface`.
 */
export default function ScoreView({ controller }: Props) {
  const { state, containerRef, viewportRef } = controller;

  return (
    <div className="score-area">
      <div className="score-viewport" ref={viewportRef}>
        <div className="score-surface" ref={containerRef} />
      </div>

      {!state.scoreLoaded && (
        <div className="score-empty">
          <div className="score-empty__inner">
            <h2>No tab loaded</h2>
            <p>Open a Guitar Pro / MusicXML file, or connect to a tab library on your network.</p>
          </div>
        </div>
      )}

      {state.rendering && state.scoreLoaded && (
        <div className="score-busy">Rendering…</div>
      )}

      {state.error && <div className="score-error">⚠ {state.error}</div>}
    </div>
  );
}
