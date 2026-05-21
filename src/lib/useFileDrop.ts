import { useEffect, useRef, useState } from "react";
import {
  type LoadedFile,
  fileFromDomFile,
  fileFromPath,
  isSupportedTabFile,
  isTauriRuntime,
} from "./runtime";

// Drag-and-drop a tab file to open it. On the Tauri desktop the OS drop is
// delivered as file paths via Tauri's drag-drop event (HTML5 drop is suppressed
// there); in the browser we use HTML5 drag events with File objects.
export function useFileDrop(onFile: (file: LoadedFile) => void): boolean {
  const [dragging, setDragging] = useState(false);
  // Keep a stable handler so the effect runs once (the listener isn't churned by
  // re-renders that give `onFile` a new identity).
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;
  const emit = (f: LoadedFile) => onFileRef.current(f);

  useEffect(() => {
    if (isTauriRuntime()) {
      let unlisten: (() => void) | undefined;
      let cancelled = false;
      import("@tauri-apps/api/webview").then(({ getCurrentWebview }) => {
        getCurrentWebview()
          .onDragDropEvent((event) => {
            const p = event.payload;
            if (p.type === "enter" || p.type === "over") {
              setDragging(true);
            } else if (p.type === "leave") {
              setDragging(false);
            } else if (p.type === "drop") {
              setDragging(false);
              const path = (p.paths ?? []).find(isSupportedTabFile);
              if (path) fileFromPath(path).then(emit).catch(() => {});
            }
          })
          .then((un) => {
            if (cancelled) un();
            else unlisten = un;
          });
      });
      return () => {
        cancelled = true;
        unlisten?.();
      };
    }

    // Browser
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && isSupportedTabFile(file.name)) fileFromDomFile(file).then(emit);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return dragging;
}
