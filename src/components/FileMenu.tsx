import { useEffect, useRef, useState } from "react";
import type { RecentEntry } from "../lib/recents";
import { ChevronDownIcon, FileIcon, FolderIcon, HistoryIcon, NetworkIcon } from "./Icons";

interface Props {
  recents: RecentEntry[];
  onOpenFile: () => void;
  onOpenLibrary: () => void;
  onOpenRecent: (entry: RecentEntry) => void;
}

export default function FileMenu({ recents, onOpenFile, onOpenLibrary, onOpenRecent }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="filemenu" ref={ref}>
      <button className="btn btn--ghost filemenu__trigger" onClick={() => setOpen((o) => !o)}>
        File
        <ChevronDownIcon width={16} height={16} />
      </button>

      {open && (
        <div className="menu" role="menu">
          <button className="menu__item" onClick={() => run(onOpenFile)}>
            <FileIcon width={16} height={16} />
            <span>Open file…</span>
            <kbd>Ctrl+O</kbd>
          </button>
          <button className="menu__item" onClick={() => run(onOpenLibrary)}>
            <FolderIcon width={16} height={16} />
            <span>Library…</span>
            <kbd>Ctrl+L</kbd>
          </button>

          <div className="menu__divider" />
          <div className="menu__label">
            <HistoryIcon width={14} height={14} />
            Recent
          </div>

          {recents.length === 0 ? (
            <div className="menu__empty">No recent files</div>
          ) : (
            recents.slice(0, 8).map((e, i) => (
              <button
                key={`${e.source.kind}-${i}`}
                className="menu__item menu__item--recent"
                onClick={() => run(() => onOpenRecent(e))}
                title={e.source.kind === "localPath" ? e.source.path : e.source.baseUrl}
              >
                {e.source.kind === "remote" ? (
                  <NetworkIcon width={16} height={16} />
                ) : (
                  <FileIcon width={16} height={16} />
                )}
                <span className="menu__name">{e.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
