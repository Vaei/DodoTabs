import type { RecentEntry } from "../lib/recents";
import { FileIcon, NetworkIcon, TrashIcon } from "./Icons";

interface Props {
  recents: RecentEntry[];
  activeKey: string | null;
  onOpen: (entry: RecentEntry) => void;
  onClear: () => void;
}

function entryKey(e: RecentEntry): string {
  return e.source.kind === "localPath"
    ? `local:${e.source.path}`
    : `remote:${e.source.baseUrl}|${e.source.path}`;
}

function subtitle(e: RecentEntry): string {
  return e.source.kind === "localPath" ? e.source.path : e.source.baseUrl;
}

export default function RecentList({ recents, activeKey, onOpen, onClear }: Props) {
  return (
    <section className="recents">
      <div className="recents__header">
        <span>Recent</span>
        {recents.length > 0 && (
          <button className="recents__clear" onClick={onClear} title="Clear recent files">
            <TrashIcon width={16} height={16} />
          </button>
        )}
      </div>

      {recents.length === 0 ? (
        <div className="recents__empty">No recent files</div>
      ) : (
        <div className="recents__list">
          {recents.map((e) => {
            const key = entryKey(e);
            return (
              <button
                key={key}
                className={`recent ${key === activeKey ? "recent--active" : ""}`}
                onClick={() => onOpen(e)}
                title={subtitle(e)}
              >
                {e.source.kind === "remote" ? (
                  <NetworkIcon className="recent__icon" width={16} height={16} />
                ) : (
                  <FileIcon className="recent__icon" width={16} height={16} />
                )}
                <span className="recent__name">{e.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
