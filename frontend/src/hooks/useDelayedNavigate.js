import { useNavigate } from "react-router-dom";

const SLIDE_DURATION = 400;
const HOLD_DURATION  = 320;

/**
 * Returns a navigate function that waits for the RouteTransition panel
 * to fully cover the screen before swapping the route.
 */
export function useDelayedNavigate() {
  const navigate = useNavigate();

  return (path) => {
    setTimeout(() => {
      navigate(path);
    }, SLIDE_DURATION + HOLD_DURATION);
  };
}