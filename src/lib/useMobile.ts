import { useEffect, useState } from "react";
import { isDesktopHost, isTauriRuntime } from "./runtime";

// True when running as the Tauri mobile (Android) client. The mobile layout
// (drawers, floating transport, orientation-aware tracks bar) only applies here;
// desktop and the plain browser keep the original layout. Resolves async via the
// OS plugin, so it starts false and flips once known. Also toggles a body class
// so global CSS (safe-area insets, touch lock) can target the mobile shell.
export function useMobile(): boolean {
  const [mobile, setMobile] = useState(false);

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
