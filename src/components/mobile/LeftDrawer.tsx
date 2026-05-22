import RecentList from "../RecentList";
import type { RecentEntry } from "../../lib/recents";

interface Props {
  open: boolean;
  onClose: () => void;
  recents: RecentEntry[];
  activeKey: string | null;
  onOpen: (entry: RecentEntry) => void;
  onRemove: (entry: RecentEntry) => void;
  onClear: () => void;
}

// Slide-in drawer holding the recent-files list. On landscape it overlays the
// fixed Tracks column; on portrait it covers the left edge of the score.
export default function LeftDrawer({
  open,
  onClose,
  recents,
  activeKey,
  onOpen,
  onRemove,
  onClear,
}: Props) {
  return (
    <>
      <div
        className={`drawer-scrim ${open ? "drawer-scrim--show" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`left-drawer ${open ? "left-drawer--open" : ""}`}>
        <RecentList
          recents={recents}
          activeKey={activeKey}
          onOpen={(entry) => {
            onOpen(entry);
            onClose();
          }}
          onRemove={onRemove}
          onClear={onClear}
        />
      </aside>
    </>
  );
}
