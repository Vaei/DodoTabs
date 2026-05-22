import type { TempoSyncController } from "../lib/useTempoSync";
import { CloseIcon, MicIcon } from "./Icons";

interface Props {
  sync: TempoSyncController;
  onClose: () => void;
}

export default function TempoSyncModal({ sync, onClose }: Props) {
  const { listening, level, beat, hasProfile, calibrating, profileClicks, error } = sync.state;
  const status = !listening ? "Idle" : beat ? "Hearing the beat" : "Listening…";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--tempo" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Play in time</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <section className="modal__section">
          <p className="settings-note">
            DodoTabs listens to your metronome only to start playback on the beat. Set the tempo
            with the <strong>BPM</strong> field in the transport bar (type your metronome's BPM, or
            Alt + scroll over the score).
          </p>

          <div className="tempo-status tempo-status--lg">
            <span className={`tempo-dot ${beat ? "tempo-dot--on" : ""}`} />
            {status}
          </div>
          <div className="tempo-level">
            <div className="tempo-level__fill" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>

          <div className="tempo-actions">
            <button
              className={`btn ${listening ? "btn--active" : "btn--primary"} tempo-listen`}
              onClick={() => (listening ? sync.stop() : void sync.start())}
            >
              <MicIcon width={18} height={18} />
              {listening ? "Stop listening" : "Start listening"}
            </button>
          </div>
          <p className="settings-note">
            While listening, toggle <strong>Sync</strong> in the transport bar — playback, loops
            and count-ins will then start on the beat.
          </p>
          {error && <p className="settings-note tempo-error">{error}</p>}
        </section>

        <section className="modal__section">
          <h3>Sound profile</h3>
          {calibrating ? (
            <p className="settings-note">
              Recording… run your metronome now. Captured <strong>{profileClicks}</strong> click
              {profileClicks === 1 ? "" : "s"}.
            </p>
          ) : (
            <>
              <p className="settings-note">
                {hasProfile
                  ? "A profile is active — the click is recognised by its sound, which helps pick out the beat even with a guitar playing."
                  : "Record your metronome alone in a quiet room so DodoTabs learns its click and can find the beat more reliably."}{" "}
                The built-in default was recorded from a <strong>Wittner Metronom System Maelzel</strong>.
              </p>
              <div className="tempo-actions">
                <button className="btn btn--primary" onClick={() => void sync.recordProfile()}>
                  {hasProfile ? "Re-record" : "Record"}
                </button>
                <button className="btn" onClick={sync.applyDefaultProfile}>
                  Default
                </button>
                {hasProfile && (
                  <button className="btn" onClick={sync.clearProfile}>
                    Clear
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
