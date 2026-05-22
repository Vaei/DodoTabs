import { useState } from "react";
import {
  APP_AUTHOR,
  APP_LICENSE,
  APP_VERSION,
  GITHUB_URL,
  THIRD_PARTY_LICENSES,
} from "../lib/constants";
import { openExternal } from "../lib/runtime";
import { CloseIcon, ExternalLinkIcon, ChevronLeftIcon } from "./Icons";

interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  const [showLicenses, setShowLicenses] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--about" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          {showLicenses ? (
            <button
              className="btn btn--ghost"
              onClick={() => setShowLicenses(false)}
              aria-label="Back"
            >
              <ChevronLeftIcon />
            </button>
          ) : (
            <span />
          )}
          <h2>{showLicenses ? "Licenses" : "About"}</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        {showLicenses ? (
          <div className="licenses">
            <p className="settings-note">
              DodoTabs is licensed under <strong>{APP_LICENSE}</strong>. It is built on the
              open-source components below; their licenses are included with the app.
            </p>
            <ul className="license-list">
              {THIRD_PARTY_LICENSES.map((l) => (
                <li key={l.name}>
                  {l.url ? (
                    <button className="license-list__name" onClick={() => openExternal(l.url!)}>
                      <span>{l.name}</span>
                      <ExternalLinkIcon width={14} height={14} />
                    </button>
                  ) : (
                    <span className="license-list__name">{l.name}</span>
                  )}
                  <span className="license-list__tag">{l.license}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="about">
            <div className="about__mark">🦤</div>
            <div className="about__name">DodoTabs</div>
            <div className="about__version">Version {APP_VERSION}</div>
            <p className="about__by">by {APP_AUTHOR}</p>
            <p className="about__license">Licensed under {APP_LICENSE}</p>

            <button className="row-action about__link" onClick={() => openExternal(GITHUB_URL)}>
              <ExternalLinkIcon />
              <div>
                <strong>GitHub</strong>
                <span>{GITHUB_URL}</span>
              </div>
            </button>

            <button className="row-action" onClick={() => setShowLicenses(true)}>
              <InfoChevron />
              <div>
                <strong>Open source licenses</strong>
                <span>The components DodoTabs is built on</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Small inline chevron-right so the licenses row mirrors the GitHub row's affordance.
function InfoChevron() {
  return <ChevronLeftIcon style={{ transform: "rotate(180deg)" }} />;
}
