import { useEffect, useState } from "react";
import {
  APP_AUTHOR,
  APP_LICENSE,
  APP_VERSION,
  GITHUB_URL,
  THIRD_PARTY_LICENSES,
} from "../lib/constants";
import {
  checkForUpdates,
  isDesktopHost,
  isLikelyMobile,
  latestReleaseIfNewer,
  openExternal,
} from "../lib/runtime";
import { CloseIcon, ExternalLinkIcon, ChevronLeftIcon, DownloadIcon } from "./Icons";

interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  const [showLicenses, setShowLicenses] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    isDesktopHost().then(setDesktop);
  }, []);

  const mobile = isLikelyMobile();

  const onCheckUpdates = async () => {
    setChecking(true);
    setUpdateStatus(null);
    try {
      if (mobile) {
        // Android has no auto-updater: check GitHub and open the release to download.
        const update = await latestReleaseIfNewer(APP_VERSION);
        if (update) {
          setUpdateStatus(`Version ${update.version} available - opening download`);
          openExternal(update.url);
        } else {
          setUpdateStatus("You're on the latest version.");
        }
      } else {
        setUpdateStatus(await checkForUpdates());
      }
    } catch {
      setUpdateStatus("Couldn't check for updates right now.");
    } finally {
      setChecking(false);
    }
  };

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

            {(desktop || mobile) && (
              <button className="row-action" onClick={onCheckUpdates} disabled={checking}>
                <DownloadIcon />
                <div>
                  <strong>{checking ? "Checking..." : "Check for updates"}</strong>
                  <span>
                    {updateStatus ??
                      (mobile
                        ? "See if a newer APK is available on GitHub"
                        : "See if a newer version is available")}
                  </span>
                </div>
              </button>
            )}
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
