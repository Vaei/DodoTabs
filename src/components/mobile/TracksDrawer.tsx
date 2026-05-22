import { useState } from "react";
import type { AlphaTabController } from "../../lib/useAlphaTab";
import { useDrawerHandle } from "../../lib/useDrawerHandle";
import TrackSidebar from "../TrackSidebar";

interface Props {
  controller: AlphaTabController;
}

// Tracks panel. In portrait this renders as a static horizontal strip (CSS); in
// landscape it's an in-flow side panel shown open by default, collapsible via its
// handle (tap or swipe) to give the score more width. Hidden when no tab is loaded.
export default function TracksDrawer({ controller }: Props) {
  // Open by default so the tracks are visible in landscape without a tap.
  const [open, setOpen] = useState(true);
  const handle = useDrawerHandle(open, setOpen, "left");

  if (!controller.state.scoreLoaded) return null;

  return (
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
  );
}
