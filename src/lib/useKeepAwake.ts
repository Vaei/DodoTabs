import { useEffect, useRef } from "react";

export const KEEP_SCREEN_ON_KEY = "dodotabs.keepScreenOn";

// Holds a screen wake lock while `active` (i.e. while playing) and the setting is on,
// so the phone screen doesn't sleep mid-practice (which on Android also stalls loop
// restarts and playback). The OS drops the lock when the page hides, so we re-acquire
// on visibilitychange. No-op where the Wake Lock API is unavailable.
export function useKeepAwake(active: boolean) {
  const lockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    const enabled = (localStorage.getItem(KEEP_SCREEN_ON_KEY) ?? "1") !== "0";
    const wakeLock = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (!active || !enabled || !wakeLock) return;

    let cancelled = false;
    const acquire = async () => {
      try {
        const sentinel = await wakeLock.request("screen");
        if (cancelled) sentinel.release().catch(() => {});
        else lockRef.current = sentinel;
      } catch {
        /* denied / not visible - ignore */
      }
    };
    acquire();

    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled && !lockRef.current) acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
