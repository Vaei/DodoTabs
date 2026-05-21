import { useEffect, useRef, useState } from "react";
import { SPEEDS, SPEED_MAX, SPEED_MIN, clampSpeed } from "../lib/constants";
import { ChevronDownIcon } from "./Icons";

interface Props {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function format(value: number): string {
  // Trim trailing zeros: 1 -> "1", 0.85 -> "0.85", 1.5 -> "1.5".
  return String(Math.round(value * 100) / 100);
}

/**
 * Speed control with both fine-grained entry (type any value, or use the input's
 * step arrows) and the quick preset list (caret dropdown). Ctrl+wheel elsewhere
 * steps the presets and updates `value`, which we mirror into the field.
 */
export default function SpeedControl({ value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(format(value));
  const ref = useRef<HTMLDivElement>(null);

  // Mirror external changes (preset dropdown, Ctrl+wheel) into the editable field.
  useEffect(() => setText(format(value)), [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const commit = (raw: string) => {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n)) onChange(clampSpeed(n));
    else setText(format(value));
  };

  return (
    <label
      className="select speedctl-wrap"
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onChange(1); // middle-click resets to 1.0x
        }
      }}
    >
      <span>Speed</span>
      <div className={`speedctl ${disabled ? "speedctl--disabled" : ""}`} ref={ref}>
        <input
          className="speedctl__input"
          type="number"
          inputMode="decimal"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={0.05}
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
        <span className="speedctl__x">×</span>
        <button
          type="button"
          className="speedctl__caret"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-label="Speed presets"
        >
          <ChevronDownIcon width={14} height={14} />
        </button>

        {open && (
          <div className="speedctl__menu">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={s === value ? "on" : ""}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
              >
                {s}×
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}
