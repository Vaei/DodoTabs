import type { AlphaTabController } from "../lib/useAlphaTab";
import { GuitarIcon } from "./Icons";

interface Props {
  controller: AlphaTabController;
}

export default function TrackSidebar({ controller }: Props) {
  const { state } = controller;

  if (!state.scoreLoaded) return null;

  const anySolo = state.tracks.some((t) => t.soloed);
  const isAudible = (t: (typeof state.tracks)[number]) => (anySolo ? t.soloed : !t.muted);
  const allMuted = state.tracks.length > 0 && state.tracks.every((t) => t.muted);

  return (
    <section className="tracks">
      <div className="tracks__header">
        <span>Tracks</span>
        <button
          className="tracks__muteall"
          onClick={() => controller.setAllTracksMuted(!allMuted)}
          title={allMuted ? "Unmute all tracks" : "Mute all tracks"}
        >
          {allMuted ? "Unmute all" : "Mute all"}
        </button>
      </div>
      <div className="tracks__list">
        {state.tracks.map((t) => (
          <div className={`track ${isAudible(t) ? "track--on" : ""}`} key={t.index}>
            <div className="track__main">
              <GuitarIcon className="track__icon" />
              <span className="track__name" title={t.name}>
                {t.name}
              </span>
            </div>

            <div className="track__controls">
              <button
                className={`tag ${t.muted ? "tag--mute" : ""}`}
                onClick={() => controller.setTrackMute(t.index, !t.muted)}
                title="Mute / hide this track"
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
