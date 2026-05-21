import type { AlphaTabController } from "../lib/useAlphaTab";
import { GuitarIcon } from "./Icons";

interface Props {
  controller: AlphaTabController;
}

export default function TrackSidebar({ controller }: Props) {
  const { state } = controller;

  if (!state.scoreLoaded) return null;

  const renderedIndexes = state.tracks.filter((t) => t.rendered).map((t) => t.index);

  const toggleRendered = (index: number) => {
    const set = new Set(renderedIndexes);
    if (set.has(index)) {
      if (set.size === 1) return; // keep at least one rendered track
      set.delete(index);
    } else {
      set.add(index);
    }
    controller.renderTracks([...set]);
  };

  return (
    <section className="tracks">
      <div className="tracks__header">Tracks</div>
      <div className="tracks__list">
        {state.tracks.map((t) => (
          <div className={`track ${t.rendered ? "track--on" : ""}`} key={t.index}>
            <button
              className="track__main"
              onClick={() => toggleRendered(t.index)}
              title="Show / hide this track in the score"
            >
              <GuitarIcon className="track__icon" />
              <span className="track__name">{t.name}</span>
            </button>

            <div className="track__controls">
              <button
                className={`tag ${t.muted ? "tag--mute" : ""}`}
                onClick={() => controller.setTrackMute(t.index, !t.muted)}
                title="Mute"
              >
                M
              </button>
              <button
                className={`tag ${t.soloed ? "tag--solo" : ""}`}
                onClick={() => controller.setTrackSolo(t.index, !t.soloed)}
                title="Solo"
              >
                S
              </button>
            </div>

            <input
              className="track__vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={t.volume}
              onChange={(e) => controller.setTrackVolume(t.index, Number(e.target.value))}
              title="Volume"
            />

            <div className="track__meter" aria-hidden="true">
              <div className="track__meter-fill" style={{ width: `${Math.round(t.activity * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
