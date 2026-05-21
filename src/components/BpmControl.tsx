import { useEffect, useState } from "react";

interface Props {
  value: number; // current target BPM (song tempo * speed), rounded
  resetTo: number; // default BPM (the tab's tempo), for middle-click reset
  disabled?: boolean;
  onChange: (bpm: number) => void;
}

/**
 * Target-tempo field. BPM is a view over the playback speed (speed = bpm / songTempo),
 * so typing a BPM updates the speed and vice-versa. Type your metronome's BPM here to
 * match it exactly.
 */
export default function BpmControl({ value, resetTo, disabled, onChange }: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(value > 0 ? String(value) : ""), [value]);

  const commit = (raw: string) => {
    const n = Math.round(Number.parseFloat(raw));
    if (Number.isFinite(n)) onChange(Math.max(20, Math.min(400, n)));
    else setText(value > 0 ? String(value) : "");
  };

  return (
    <label
      className="select"
      onMouseDown={(e) => {
        if (e.button === 1 && resetTo > 0) {
          e.preventDefault();
          onChange(resetTo); // middle-click resets to the tab's tempo (1.0x)
        }
      }}
    >
      <span>BPM</span>
      <input
        className="bpmctl"
        type="number"
        min={20}
        max={400}
        step={1}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}
