import { useEffect, useState } from "react";
import { isDesktopHost, isLikelyMobile, isTauriRuntime } from "./runtime";

// True when running as the Tauri mobile (Android) client. The mobile layout
// (drawers, floating transport, orientation-aware tracks bar) only applies here;
// desktop and the plain browser keep the original layout. Seeded synchronously from
// the user agent so the first paint is already correct (no desktop-UI flash on
// launch/resume), then confirmed via the OS plugin. Also toggles a body class so
// global CSS (safe-area insets, touch lock) can target the mobile shell.
export function useMobile(): boolean {
  const [mobile, setMobile] = useState(isLikelyMobile);

  useEffect(() => {
    let cancelled = false;
    if (!isTauriRuntime()) return;
    isDesktopHost().then((isHost) => {
      if (!cancelled) setMobile(!isHost);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-mobile", mobile);
  }, [mobile]);

  return mobile;
}
