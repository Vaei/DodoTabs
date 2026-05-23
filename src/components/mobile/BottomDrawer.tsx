import { useState } from "react";
import type { AlphaTabController } from "../../lib/useAlphaTab";
import { METRONOME_SYNC, ZOOMS } from "../../lib/constants";
import { useDrawerHandle } from "../../lib/useDrawerHandle";
import SpeedControl from "../SpeedControl";
import BpmControl from "../BpmControl";
import { ChevronDownIcon, LayoutIcon, MicIcon, RangeIcon, CloseIcon } from "../Icons";

interface Props {
  controller: AlphaTabController;
  syncEnabled: boolean;
  syncAvailable: boolean;
  onToggleSync: () => void;
  onOpenMic: () => void;
}

// Bottom sheet holding the secondary controls (speed, BPM, zoom, layout, sync).
// A handle peeks above the screen edge; tapping it slides the sheet up.
export default function BottomDrawer({
  controller,
  syncEnabled,
  syncAvailable,
  onToggleSync,
  onOpenMic,
}: Props) {
  const [open, setOpen] = useState(false);
  const handle = useDrawerHandle(open, setOpen, "bottom");
  const { state } = controller;
  const disabled = !state.scoreLoaded;

  return (
    <>
      <div
        className={`drawer-scrim ${open ? "drawer-scrim--show" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className={`bottom-drawer ${open ? "bottom-drawer--open" : ""}`}>
        <button
          className="bottom-drawer__handle"
          {...handle}
          aria-label={open ? "Hide controls" : "Show controls"}
        >
          <ChevronDownIcon
            width={20}
            height={20}
            style={{ transform: open ? "none" : "rotate(180deg)" }}
          />
        </button>

        <div className="bottom-drawer__body">
          <button
            className={`btn btn--wide bottom-sync ${state.tapSelecting ? "btn--active" : ""}`}
            onClick={() => {
              controller.toggleTapSelect();
              setOpen(false);
            }}
            disabled={disabled}
            title="Pick a section to loop by tapping its start beat, then its end beat"
          >
            <RangeIcon width={16} height={16} />
            <span>{state.tapSelecting ? "Tap start, then end beat" : "Select loop section"}</span>
          </button>

          {state.hasSelection && (
            <button
              className="btn btn--wide bottom-sync"
              onClick={() => controller.clearSelection()}
            >
              <CloseIcon width={16} height={16} />
              <span>Clear loop section</span>
            </button>
          )}

          {METRONOME_SYNC && (
            <button
              className={`btn btn--wide bottom-sync ${syncEnabled && syncAvailable ? "btn--active" : ""}`}
              onClick={() => (syncAvailable ? onToggleSync() : onOpenMic())}
              title={
                syncAvailable
                  ? "Sync to metronome: start playback (and each loop) on the beat"
                  : "Open the metronome mic dialog and start listening"
              }
            >
              <MicIcon width={16} height={16} />
              <span>Sync to metronome</span>
            </button>
          )}

          <div className="bottom-drawer__row">
            <SpeedControl value={state.speed} disabled={disabled} onChange={controller.setSpeed} />
            <BpmControl
              value={state.tempo > 0 ? Math.round(state.tempo * state.speed) : 0}
              resetTo={state.tempo}
              disabled={disabled || state.tempo <= 0}
              onChange={controller.setBpm}
            />
          </div>

          <div className="bottom-drawer__row">
            <label
              className="select"
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  controller.setZoom(1);
                }
              }}
            >
              <span>Zoom</span>
              <select
                value={state.zoom}
                disabled={disabled}
                onChange={(e) => controller.setZoom(Number(e.target.value))}
              >
                {ZOOMS.map((z) => (
                  <option key={z} value={z}>
                    {Math.round(z * 100)}%
                  </option>
                ))}
              </select>
            </label>

            <label className="select">
              <span>Layout</span>
              <button
                className="btn btn--wide btn--field"
                disabled={disabled}
                onClick={() => controller.setLayout(state.layout === "page" ? "horizontal" : "page")}
                title="Toggle page / scroll layout"
              >
                <LayoutIcon width={16} height={16} />
                <span>{state.layout === "page" ? "Page" : "Scroll"}</span>
              </button>
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
