import { useState } from "react";
import type { RecentEntry } from "../../lib/recents";
import { useDrawerHandle } from "../../lib/useDrawerHandle";
import FileMenu from "../FileMenu";
import { FolderIcon, MicIcon, HistoryIcon, ChevronDownIcon } from "../Icons";

interface Props {
  title: string;
  artist: string;
  scoreLoaded: boolean;
  micActive: boolean;
  recents: RecentEntry[];
  onOpenFile: () => void;
  onOpenLibrary: () => void;
  onOpenRecent: (entry: RecentEntry) => void;
  onOpenRecents: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenMic: () => void;
}

// Top edge drawer holding the menu bar. Collapsed it is a thin handle showing the
// loaded tab's title; tap or swipe down to reveal File / Settings / About / mic /
// Library and a Recents button. Used in both orientations.
export default function TopDrawer({
  title,
  artist,
  scoreLoaded,
  micActive,
  recents,
  onOpenFile,
  onOpenLibrary,
  onOpenRecent,
  onOpenRecents,
  onOpenSettings,
  onOpenAbout,
  onOpenMic,
}: Props) {
  const [open, setOpen] = useState(false);
  const handle = useDrawerHandle(open, setOpen, "top");

  const close = () => setOpen(false);

  return (
    <>
      <div
        className={`drawer-scrim ${open ? "drawer-scrim--show" : ""}`}
        onClick={close}
        aria-hidden="true"
      />
      <div className={`top-drawer ${open ? "top-drawer--open" : ""}`}>
        <div className="top-drawer__body">
          <div className="brand">
            <span className="brand__mark">🦤</span>
            <span className="brand__name">DodoTabs</span>
          </div>
          <nav className="menubar">
            <FileMenu
              recents={recents}
              onOpenFile={() => {
                close();
                onOpenFile();
              }}
              onOpenLibrary={() => {
                close();
                onOpenLibrary();
              }}
              onOpenRecent={(e) => {
                close();
                onOpenRecent(e);
              }}
            />
            <button
              className="btn btn--ghost menubar-item"
              onClick={() => {
                close();
                onOpenSettings();
              }}
            >
              Settings
            </button>
            <button
              className="btn btn--ghost menubar-item"
              onClick={() => {
                close();
                onOpenAbout();
              }}
            >
              About
            </button>
            <button
              className="btn btn--ghost menubar-item"
              onClick={() => {
                close();
                onOpenRecents();
              }}
            >
              <HistoryIcon width={16} height={16} />
              Recent
            </button>
          </nav>
          <div className="top-drawer__actions">
            <button
              className={`btn ${micActive ? "btn--active" : ""}`}
              onClick={() => {
                close();
                onOpenMic();
              }}
              title="Play in time with a metronome (mic)"
            >
              <MicIcon />
            </button>
            <button
              className="btn btn--primary"
              onClick={() => {
                close();
                onOpenLibrary();
              }}
            >
              <FolderIcon />
              <span>Library</span>
            </button>
          </div>
        </div>

        <button
          className="top-drawer__handle"
          {...handle}
          aria-label={open ? "Hide menu" : "Show menu"}
        >
          <span className="top-drawer__title">
            {scoreLoaded ? title || "Untitled" : "DodoTabs"}
            {scoreLoaded && artist ? ` - ${artist}` : ""}
          </span>
          <ChevronDownIcon
            width={18}
            height={18}
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          />
        </button>
      </div>
    </>
  );
}
