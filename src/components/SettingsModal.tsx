import { useEffect, useState } from "react";
import type { AlphaTabController, AudioDeviceInfo } from "../lib/useAlphaTab";
import {
  COUNT_IN_FULL_SPEED_KEY,
  TAB_ONLY_KEY,
  DRUM_GLYPHS_KEY,
  BAR_STRETCH_KEY,
  TRACK_WHITELIST_KEY,
  TRACK_BLACKLIST_KEY,
} from "../lib/useAlphaTab";
import { KEEP_SCREEN_ON_KEY } from "../lib/useKeepAwake";
import { AUTO_LOAD_LAST_KEY, METRONOME_SYNC } from "../lib/constants";
import { isLikelyMobile } from "../lib/runtime";
import {
  AUTO_SAVE_TAB_KEY,
  listTabSettings,
  deleteTabSettings,
  deleteAllTabSettings,
} from "../lib/tabSettings";
import { SHOW_VOCALS_ON_TRACK_KEY } from "../lib/vocalOverlay";
import { RESTORE_SESSION_KEY } from "../lib/session";
import { CloseIcon, TrashIcon } from "./Icons";

interface Props {
  controller: AlphaTabController;
  skipSeconds: number;
  onChangeSkipSeconds: (v: number) => void;
  bpmStep: number;
  onChangeBpmStep: (v: number) => void;
  onClose: () => void;
}

const INPUT_DEVICE_KEY = "dodotabs.inputDevice";
const SYNC_OFFSET_KEY = "dodotabs.syncOffsetMs";

export default function SettingsModal({
  controller,
  skipSeconds,
  onChangeSkipSeconds,
  bpmStep,
  onChangeBpmStep,
  onClose,
}: Props) {
  // Android can't switch the audio output device (no setSinkId) and granting access
  // would only trigger a confusing microphone prompt, so the "Grant device access"
  // button is desktop-only.
  const mobile = isLikelyMobile();
  const [outputs, setOutputs] = useState<AudioDeviceInfo[]>([]);
  const [inputs, setInputs] = useState<AudioDeviceInfo[]>([]);
  const [outputId, setOutputId] = useState<string>(
    () => localStorage.getItem("dodotabs.outputDevice") ?? ""
  );
  const [inputId, setInputId] = useState<string>(
    () => localStorage.getItem(INPUT_DEVICE_KEY) ?? ""
  );
  const [needsMicPermission, setNeedsMicPermission] = useState(false);
  const [syncOffset, setSyncOffset] = useState<number>(() => {
    const v = Number.parseFloat(localStorage.getItem(SYNC_OFFSET_KEY) ?? "0");
    return Number.isFinite(v) ? v : 0;
  });
  const [countInFullSpeed, setCountInFullSpeed] = useState(
    () => (localStorage.getItem(COUNT_IN_FULL_SPEED_KEY) ?? "1") !== "0"
  );
  const [keepScreenOn, setKeepScreenOn] = useState(
    () => (localStorage.getItem(KEEP_SCREEN_ON_KEY) ?? "1") !== "0"
  );
  const [tabOnly, setTabOnlyState] = useState(
    () => (localStorage.getItem(TAB_ONLY_KEY) ?? "0") !== "0"
  );
  const [drumGlyphs, setDrumGlyphsState] = useState(
    () => (localStorage.getItem(DRUM_GLYPHS_KEY) ?? "1") !== "0"
  );
  const [showVocals, setShowVocalsState] = useState(
    () => localStorage.getItem(SHOW_VOCALS_ON_TRACK_KEY) === "1"
  );
  const changeShowVocals = (v: boolean) => {
    setShowVocalsState(v);
    localStorage.setItem(SHOW_VOCALS_ON_TRACK_KEY, v ? "1" : "0");
    controller.reloadCurrent(); // reopen so the overlay is applied/removed cleanly
  };
  const [barStretch, setBarStretchState] = useState(() => {
    const v = Number.parseFloat(localStorage.getItem(BAR_STRETCH_KEY) ?? "1");
    return Number.isFinite(v) && v > 0 ? v : 1;
  });
  const [autoLoadLast, setAutoLoadLastState] = useState(
    () => (localStorage.getItem(AUTO_LOAD_LAST_KEY) ?? "1") !== "0"
  );
  const [autoSaveTab, setAutoSaveTabState] = useState(
    () => localStorage.getItem(AUTO_SAVE_TAB_KEY) === "1"
  );
  const [savedTabs, setSavedTabs] = useState<string[]>(() => listTabSettings());
  const changeAutoSaveTab = (v: boolean) => {
    setAutoSaveTabState(v);
    localStorage.setItem(AUTO_SAVE_TAB_KEY, v ? "1" : "0");
  };
  const deleteSavedTab = (name: string) => {
    deleteTabSettings(name);
    setSavedTabs(listTabSettings());
  };
  const deleteAllSavedTabs = () => {
    if (!window.confirm("Delete saved setups for all tabs?")) return;
    deleteAllTabSettings();
    setSavedTabs([]);
  };
  const changeAutoLoadLast = (v: boolean) => {
    setAutoLoadLastState(v);
    localStorage.setItem(AUTO_LOAD_LAST_KEY, v ? "1" : "0");
  };
  const [restoreSession, setRestoreSessionState] = useState(
    () => (localStorage.getItem(RESTORE_SESSION_KEY) ?? "1") !== "0"
  );
  const changeRestoreSession = (v: boolean) => {
    setRestoreSessionState(v);
    localStorage.setItem(RESTORE_SESSION_KEY, v ? "1" : "0");
  };

  const changeTabOnly = (v: boolean) => {
    setTabOnlyState(v);
    localStorage.setItem(TAB_ONLY_KEY, v ? "1" : "0");
    controller.setTabOnly(v);
  };
  const changeDrumGlyphs = (v: boolean) => {
    setDrumGlyphsState(v);
    localStorage.setItem(DRUM_GLYPHS_KEY, v ? "1" : "0");
    controller.applyDrumGlyphs();
  };
  const changeBarStretch = (v: number) => {
    setBarStretchState(v);
    localStorage.setItem(BAR_STRETCH_KEY, String(v));
    controller.setBarStretch(v);
  };
  const changeTrackList = (key: string, value: string) => {
    // Only persist; the filter is applied when a tab is loaded, so it never disrupts
    // the tracks you've muted/soloed in the current session.
    localStorage.setItem(key, value);
  };

  const changeSyncOffset = (v: number) => {
    setSyncOffset(v);
    localStorage.setItem(SYNC_OFFSET_KEY, String(v));
  };
  const changeCountInFullSpeed = (v: boolean) => {
    setCountInFullSpeed(v);
    localStorage.setItem(COUNT_IN_FULL_SPEED_KEY, v ? "1" : "0");
  };
  const changeKeepScreenOn = (v: boolean) => {
    setKeepScreenOn(v);
    localStorage.setItem(KEEP_SCREEN_ON_KEY, v ? "1" : "0");
  };

  // Output devices come from alphaTab (uses setSinkId where supported; returns an
  // empty list on platforms that can't switch output, e.g. some Android webviews).
  // The non-default devices are only listed once media-device access is granted.
  const loadOutputs = () => controller.listOutputDevices().then(setOutputs);
  useEffect(() => {
    loadOutputs();
  }, [controller]);

  // Input (mic) devices - enumerated for a future "detect the room metronome" feature.
  // Labels are only visible after the user grants microphone access.
  const loadInputs = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
      setInputs(mics);
      setNeedsMicPermission(mics.length > 0 && mics.every((m) => m.label === ""));
    } catch {
      setInputs([]);
    }
  };

  useEffect(() => {
    loadInputs();
  }, []);

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      await loadInputs();
      await loadOutputs(); // granting access also unlocks the output device list
    } catch {
      /* permission denied */
    }
  };

  const onOutputChange = (id: string) => {
    setOutputId(id);
    controller.setOutputDevice(id || null);
  };

  const onInputChange = (id: string) => {
    setInputId(id);
    if (id) localStorage.setItem(INPUT_DEVICE_KEY, id);
    else localStorage.removeItem(INPUT_DEVICE_KEY);
  };

  // Whether the platform can switch the audio output device at all (uses setSinkId).
  // This is distinct from "no devices enumerated yet" (e.g. before a tab is loaded).
  const outputSupported =
    typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>Settings</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <section className="modal__section">
          <h3>Startup</h3>
          <label className="settings-row">
            <span>Reopen the last tab on startup</span>
            <input
              type="checkbox"
              checked={autoLoadLast}
              onChange={(e) => changeAutoLoadLast(e.target.checked)}
            />
          </label>
          <label className="settings-row">
            <span>Pick up where you left off</span>
            <input
              type="checkbox"
              checked={restoreSession}
              disabled={!autoLoadLast}
              onChange={(e) => changeRestoreSession(e.target.checked)}
            />
          </label>
          <p className="settings-note">
            Restores the reopened tab's count-in, metronome, looped section, snap-to-bar,
            speed, zoom, layout and cursor position from your last session.
          </p>
        </section>

        <section className="modal__section">
          <h3>Playback</h3>
          <label className="settings-row">
            <span>Skip amount (Shift+A / D)</span>
            <span className="settings-inline">
              <input
                className="settings-number"
                type="number"
                min={0.5}
                max={60}
                step={0.5}
                defaultValue={skipSeconds}
                onBlur={(e) => onChangeSkipSeconds(Number.parseFloat(e.target.value))}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    (e.currentTarget as HTMLInputElement).value = "3";
                    onChangeSkipSeconds(3);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onChangeSkipSeconds(Number.parseFloat((e.target as HTMLInputElement).value));
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              <span className="settings-unit">sec</span>
            </span>
          </label>
          <label className="settings-row">
            <span>BPM scroll step (Alt + scroll)</span>
            <span className="settings-inline">
              <input
                className="settings-number"
                type="number"
                min={0.5}
                max={20}
                step={0.5}
                defaultValue={bpmStep}
                onBlur={(e) => onChangeBpmStep(Number.parseFloat(e.target.value))}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    (e.currentTarget as HTMLInputElement).value = "1";
                    onChangeBpmStep(1);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onChangeBpmStep(Number.parseFloat((e.target as HTMLInputElement).value));
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              <span className="settings-unit">BPM</span>
            </span>
          </label>
          <label className="settings-row">
            <span>Count-in plays at full speed (ignores playback speed)</span>
            <input
              type="checkbox"
              checked={countInFullSpeed}
              onChange={(e) => changeCountInFullSpeed(e.target.checked)}
            />
          </label>
          <label className="settings-row">
            <span>Keep screen on while playing</span>
            <input
              type="checkbox"
              checked={keepScreenOn}
              onChange={(e) => changeKeepScreenOn(e.target.checked)}
            />
          </label>
          {METRONOME_SYNC && (
            <>
              <label className="settings-row">
                <span>Tempo-sync offset</span>
                <span className="settings-inline">
                  <input
                    type="range"
                    min={-200}
                    max={200}
                    step={5}
                    value={syncOffset}
                    onChange={(e) => changeSyncOffset(Number(e.target.value))}
                    onMouseDown={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        changeSyncOffset(0);
                      }
                    }}
                  />
                  <span className="settings-unit settings-unit--wide">{syncOffset} ms</span>
                </span>
              </label>
              <p className="settings-note">
                Adjusts when "Play on the beat" starts, to compensate for mic/output latency.
                Positive starts the song later; negative earlier.
              </p>
            </>
          )}
        </section>

        <section className="modal__section">
          <h3>Notation</h3>
          <label className="settings-row">
            <span>Show tab only (hide notation staff)</span>
            <input
              type="checkbox"
              checked={tabOnly}
              onChange={(e) => changeTabOnly(e.target.checked)}
            />
          </label>
          <label className="settings-row">
            <span>Show drum glyphs (percussion notation)</span>
            <input
              type="checkbox"
              checked={drumGlyphs}
              onChange={(e) => changeDrumGlyphs(e.target.checked)}
            />
          </label>
          <label className="settings-row">
            <span>Show vocals on the displayed track</span>
            <input
              type="checkbox"
              checked={showVocals}
              onChange={(e) => changeShowVocals(e.target.checked)}
            />
          </label>
          <p className="settings-note">
            Overlays the song's lyrics above whichever track you view, aligned to the music
            (for tabs that include a vocal/lyrics track).
          </p>
          <label className="settings-row">
            <span>Bar width</span>
            <span className="settings-inline">
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={barStretch}
                onChange={(e) => changeBarStretch(Number(e.target.value))}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    changeBarStretch(1);
                  }
                }}
              />
              <span className="settings-unit settings-unit--wide">{barStretch.toFixed(1)}x</span>
            </span>
          </label>
          <label className="settings-row">
            <span>Only show tracks containing</span>
            <input
              className="settings-text"
              type="text"
              defaultValue={localStorage.getItem(TRACK_WHITELIST_KEY) ?? ""}
              placeholder="e.g. guitar, bass"
              onBlur={(e) => changeTrackList(TRACK_WHITELIST_KEY, e.target.value)}
            />
          </label>
          <label className="settings-row">
            <span>Hide tracks containing</span>
            <input
              className="settings-text"
              type="text"
              defaultValue={localStorage.getItem(TRACK_BLACKLIST_KEY) ?? ""}
              placeholder="e.g. drums, vocals"
              onBlur={(e) => changeTrackList(TRACK_BLACKLIST_KEY, e.target.value)}
            />
          </label>
          <p className="settings-note">
            Track filters match track names (comma-separated). Hidden tracks are muted too.
          </p>
        </section>

        <section className="modal__section">
          <h3>Tab memory</h3>
          <label className="settings-row">
            <span>Remember each tab's setup automatically</span>
            <input
              type="checkbox"
              checked={autoSaveTab}
              onChange={(e) => changeAutoSaveTab(e.target.checked)}
            />
          </label>
          <p className="settings-note">
            Saves each tab's track mixer (mute/solo/volume/show-hide), speed and zoom by file
            name, restored when you reopen it. When off, use the <strong>Save</strong> button on
            the tracks panel to store the open tab (and <strong>Reset</strong> to clear it).
          </p>
          {savedTabs.length > 0 ? (
            <>
              <div className="saved-tabs">
                {savedTabs.map((name) => (
                  <div className="saved-tabs__row" key={name}>
                    <span className="saved-tabs__name" title={name}>
                      {name}
                    </span>
                    <button
                      className="saved-tabs__del"
                      onClick={() => deleteSavedTab(name)}
                      title={`Delete saved setup for ${name}`}
                      aria-label={`Delete saved setup for ${name}`}
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn btn--ghost settings-grant" onClick={deleteAllSavedTabs}>
                Delete all saved tabs
              </button>
            </>
          ) : (
            <p className="settings-note">No tabs have a saved setup yet.</p>
          )}
        </section>

        <section className="modal__section">
          <h3>Audio output</h3>
          {outputSupported ? (
            <>
              <select
                className="settings-select"
                value={outputId}
                onChange={(e) => onOutputChange(e.target.value)}
              >
                <option value="">System default</option>
                {outputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Output device"}
                  </option>
                ))}
              </select>
              {outputs.length === 0 && !mobile && (
                <>
                  <button className="btn btn--primary settings-grant" onClick={requestMic}>
                    Grant device access
                  </button>
                  <p className="settings-note">
                    Only the system default is shown. Grant device access to list your other
                    output devices.
                  </p>
                </>
              )}
            </>
          ) : (
            <p className="settings-note">
              This platform can't switch the audio output device; playback uses the system
              default.
            </p>
          )}
        </section>

        {METRONOME_SYNC && (
          <section className="modal__section">
            <h3>Microphone (input)</h3>
            <select
              className="settings-select"
              value={inputId}
              onChange={(e) => onInputChange(e.target.value)}
            >
              <option value="">System default</option>
              {inputs.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </select>
            {needsMicPermission && (
              <button className="btn btn--primary settings-grant" onClick={requestMic}>
                Grant microphone access
              </button>
            )}
            <p className="settings-note">
              Used to listen for a physical metronome in the room, to start playback in time
              with it.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
