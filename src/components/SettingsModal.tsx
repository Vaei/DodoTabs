import { useEffect, useState } from "react";
import type { AlphaTabController, AudioDeviceInfo } from "../lib/useAlphaTab";
import { CloseIcon } from "./Icons";

interface Props {
  controller: AlphaTabController;
  skipSeconds: number;
  onChangeSkipSeconds: (v: number) => void;
  onClose: () => void;
}

const INPUT_DEVICE_KEY = "dodotabs.inputDevice";

export default function SettingsModal({
  controller,
  skipSeconds,
  onChangeSkipSeconds,
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

  const outputSupported = outputs.length > 0;

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
        </section>

        <section className="modal__section">
          <h3>Audio output</h3>
          {outputSupported ? (
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
          ) : (
            <p className="settings-note">
              Choosing an output device isn't supported on this platform - playback uses the
              system default.
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
