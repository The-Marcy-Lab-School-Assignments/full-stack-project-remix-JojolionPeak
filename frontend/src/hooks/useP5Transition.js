import { useState, useCallback, useRef, useEffect } from "react";

const SLIDE_DURATION = 380;
const HOLD_DURATION  = 300;

/**
 * useP5Transition
 * Returns { phase, trigger }
 * Call trigger(callback) to fire the animation; callback runs at the midpoint
 * (while the panel is fully covering the screen) so the view swap is invisible.
 */
export function useP5Transition() {
  const [phase, setPhase] = useState("idle");
  const timerA = useRef(null);
  const timerB = useRef(null);

  const trigger = useCallback((onMidpoint) => {
    clearTimeout(timerA.current);
    clearTimeout(timerB.current);

    setPhase("slide-in");

    timerA.current = setTimeout(() => {
      onMidpoint?.();
      setPhase("slide-out");
      timerB.current = setTimeout(() => setPhase("idle"), SLIDE_DURATION);
    }, SLIDE_DURATION + HOLD_DURATION);
  }, []);

  useEffect(() => () => {
    clearTimeout(timerA.current);
    clearTimeout(timerB.current);
  }, []);

  return { phase, trigger };
}