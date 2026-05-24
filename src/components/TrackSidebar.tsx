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
  // Effective sheet visibility: "auto" follows audibility, otherwise the pinned value.
  const isDisplayed = (t: (typeof state.tracks)[number]) =>
    t.display === "shown" ? true : t.display === "hidden" ? false : isAudible(t);
  const allMuted = state.tracks.length > 0 && state.tracks.every((t) => t.muted);
  const allShown = state.tracks.length > 0 && state.tracks.every((t) => isDisplayed(t));

  return (
    <section className="tracks">
      <div className="tracks__header">
        <span>Tracks</span>
        <div className="tracks__bulk">
          <button
            className="tracks__muteall"
            onClick={() => controller.setAllTracksMuted(!allMuted)}
            title={allMuted ? "Unmute all tracks" : "Mute all tracks"}
          >
            {allMuted ? "Unmute all" : "Mute all"}
          </button>
          <button
            className="tracks__muteall"
            onClick={() => controller.setAllTracksDisplay(!allShown)}
            title={allShown ? "Hide all tracks from the sheet" : "Show all tracks on the sheet"}
          >
            {allShown ? "Hide all" : "Show all"}
          </button>
          <button
            className="tracks__muteall"
            onClick={() => controller.saveTabSettings()}
            title="Save this tab's track setup, speed and zoom (restored when you reopen it)"
          >
            Save
          </button>
          <button
            className="tracks__muteall"
            onClick={() => {
              if (
                window.confirm(
                  "Reset this tab to defaults? This clears its saved setup and reopens it."
                )
              )
                controller.resetTabSettings();
            }}
            title="Clear this tab's saved setup and reopen it at defaults"
          >
            Reset
          </button>
        </div>
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
                title="Mute this track"
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
              <button
                className={`tag ${isDisplayed(t) ? "tag--show" : ""}`}
                onClick={() => controller.setTrackDisplay(t.index, !isDisplayed(t))}
                title="Show / hide this track on the sheet"
              >
                T
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
