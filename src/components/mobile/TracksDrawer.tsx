import { useState } from "react";
import type { AlphaTabController } from "../../lib/useAlphaTab";
import { useDrawerHandle } from "../../lib/useDrawerHandle";
import TrackSidebar from "../TrackSidebar";

interface Props {
  controller: AlphaTabController;
}

// Tracks panel. In portrait this renders as a static horizontal strip (CSS); in
// landscape it becomes a left-edge drawer with a grab handle, opened by tap or
// swipe. Separate from the Recents pop-out. Hidden entirely when no tab is loaded.
export default function TracksDrawer({ controller }: Props) {
  const [open, setOpen] = useState(false);
  const handle = useDrawerHandle(open, setOpen, "left");

  if (!controller.state.scoreLoaded) return null;

  return (
    <>
      <div
        className={`drawer-scrim drawer-scrim--tracks ${open ? "drawer-scrim--show" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className={`tracks-drawer ${open ? "tracks-drawer--open" : ""}`}>
        <div className="tracks-drawer__body">
          <TrackSidebar controller={controller} />
        </div>
        <button
          className="tracks-drawer__handle"
          {...handle}
          aria-label={open ? "Hide tracks" : "Show tracks"}
        >
          <span className="tracks-drawer__label">Tracks</span>
        </button>
      </div>
    </>
  );
}
