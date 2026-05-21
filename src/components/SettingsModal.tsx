import { useEffect, useState } from "react";
import type { AlphaTabController, AudioDeviceInfo } from "../lib/useAlphaTab";
import { CloseIcon } from "./Icons";

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

  const changeSyncOffset = (v: number) => {
    setSyncOffset(v);
    localStorage.setItem(SYNC_OFFSET_KEY, String(v));
  };

  // Output devices come from alphaTab (uses setSinkId where supported; returns an
  // empty list on platforms that can't switch output, e.g. some Android webviews).
  useEffect(() => {
    controller.listOutputDevices().then(setOutputs);
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
              {outputs.length === 0 && (
                <p className="settings-note">
                  Only the system default is available right now. Other output devices appear
                  here once playback has started.
                </p>
              )}
            </>
          ) : (
            <p className="settings-note">
              This platform can't switch the audio output device; playback uses the system
              default.
            </p>
          )}
        </section>

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
            Used by an upcoming feature that listens for a physical metronome in the room.
          </p>
        </section>
      </div>
    </div>
  );
}
