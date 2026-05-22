import { useRef } from "react";

type Edge = "top" | "bottom" | "left" | "right";

// Handle props for an edge drawer that opens on either a tap or a swipe. A tap
// toggles; a swipe past the threshold opens/closes based on its direction
// relative to the drawer's edge. After a swipe the trailing click is swallowed
// so the two gestures don't both fire.
export function useDrawerHandle(open: boolean, setOpen: (v: boolean) => void, edge: Edge) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const THRESHOLD = 28;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    let opening: boolean | null = null;
    if (edge === "bottom" && Math.abs(dy) > THRESHOLD) opening = dy < 0;
    else if (edge === "top" && Math.abs(dy) > THRESHOLD) opening = dy > 0;
    else if (edge === "left" && Math.abs(dx) > THRESHOLD) opening = dx > 0;
    else if (edge === "right" && Math.abs(dx) > THRESHOLD) opening = dx < 0;
    if (opening !== null) {
      swipedRef.current = true;
      setOpen(opening);
    }
  };

  const onClick = () => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    setOpen(!open);
  };

  return { onClick, onTouchStart, onTouchEnd };
}
