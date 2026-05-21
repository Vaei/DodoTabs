import { APP_AUTHOR, APP_VERSION, GITHUB_URL } from "../lib/constants";
import { openExternal } from "../lib/runtime";
import { CloseIcon, ExternalLinkIcon } from "./Icons";

interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--about" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>About</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="about">
          <div className="about__mark">🦤</div>
          <div className="about__name">DodoTabs</div>
          <div className="about__version">Version {APP_VERSION}</div>
          <p className="about__by">by {APP_AUTHOR}</p>

          <button className="row-action about__link" onClick={() => openExternal(GITHUB_URL)}>
            <ExternalLinkIcon />
            <div>
              <strong>GitHub</strong>
              <span>{GITHUB_URL}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
