import { useEffect, useRef, useState } from "react";

/**
 * RouteTransition
 *
 * Wraps your router outlet. Whenever `location` changes (and `isLogoPlaying`
 * is false), the Persona 5 art slides in from the left, pauses briefly, then
 * slides out to the right — revealing the new page underneath.
 *
 * Props:
 *   location      — current route string (e.g. from useLocation().pathname)
 *   isLogoPlaying — boolean; pass `true` while your intro logo animation runs
 *   children      — the page content to render
 *
 * Usage (React Router v6 example):
 *   const { pathname } = useLocation();
 *   <RouteTransition location={pathname} isLogoPlaying={logoRunning}>
 *     <Outlet />
 *   </RouteTransition>
 */

const SLIDE_DURATION = 400;  
const HOLD_DURATION  = 320;  

export default function RouteTransition({ location, isLogoPlaying, suppressNext, children }) {
  const [phase, setPhase] = useState("idle");
  const prevLocation = useRef(location);
  const timerA = useRef(null);
  const timerB = useRef(null);

  useEffect(() => {
    if (location === prevLocation.current) return;
    prevLocation.current = location;
    if (isLogoPlaying) return;
    if (suppressNext?.current) { suppressNext.current = false; return; }

    clearTimeout(timerA.current);
    clearTimeout(timerB.current);

    setPhase("slide-in");
    timerA.current = setTimeout(() => {
      setPhase("slide-out");
      timerB.current = setTimeout(() => setPhase("idle"), SLIDE_DURATION);
    }, SLIDE_DURATION + HOLD_DURATION);

    return () => {
      clearTimeout(timerA.current);
      clearTimeout(timerB.current);
    };
  }, [location, isLogoPlaying]);

  const isVisible = phase !== "idle";

  const overlayStyle = {
    position:   "fixed",
    inset:      0,
    zIndex:     9999,
    pointerEvents: isVisible ? "all" : "none",
    overflow:   "hidden",
  };

  const panelStyle = {
    position:   "absolute",
    inset:      0,
    display:    "flex",
    alignItems: "stretch",
    transform:  phase === "idle"      ? "translateX(-110%)"
               : phase === "slide-in"  ? "translateX(0%)"
               : "translateX(110%)",
    transition: phase === "idle"
      ? "none"
      : `transform ${SLIDE_DURATION}ms cubic-bezier(0.7,0,0.3,1)`,
    willChange: "transform",
  };

  const leftStyle = {
    flex:       "0 0 50%",
    background: "#c0161b",
    position:   "relative",
    overflow:   "hidden",
  };

  const rightStyle = {
    flex:       "0 0 50%",
    background: "#0d0d0d",
    position:   "relative",
    overflow:   "hidden",
  };

  const artStyle = {
    position:   "absolute",
    top:        "50%",
    left:       "50%",
    transform:  "translate(-50%, -50%)",
    width:      "min(90vw, 600px)",
    aspectRatio: "3 / 4.2",
    zIndex:     1,
    backgroundImage:    `url("./persona5_swipe_menu.png")`,
    backgroundSize:     "cover",
    backgroundPosition: "center",
    filter:     "drop-shadow(0 0 24px rgba(255,255,255,0.25))",
    rotate:     "-2deg",
  };

  const slashStyle = {
    position:     "absolute",
    top:          0,
    left:         "50%",
    width:        "6px",
    height:       "100%",
    background:   "white",
    transform:    "translateX(-50%) skewX(-8deg)",
    zIndex:       2,
  };

  const ribbonBase = {
    position: "absolute",
    width:    "180px",
    height:   "8px",
    background: "#c0161b",
    zIndex: 3,
  };

  return (
    <>
      {children}

      <div style={overlayStyle} aria-hidden="true">
        <div style={panelStyle}>
          <div style={leftStyle}>
            <svg
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.08 }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="diag" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="24" stroke="white" strokeWidth="6" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#diag)" />
            </svg>

            <div style={{
              position: "absolute",
              bottom: "10%",
              left: "50%",
              transform: "translateX(-50%)",
              color: "white",
              fontFamily: "'Arial Black', 'Impact', sans-serif",
              fontSize: "clamp(12px, 3vw, 22px)",
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              fontStyle: "italic",
              whiteSpace: "nowrap",
              opacity: 0.9,
            }}>
              Mementos
            </div>
          </div>

          <div style={rightStyle}>
            <svg
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.18 }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="stars" width="120" height="120" patternUnits="userSpaceOnUse">
                  <polygon
                    points="60,10 72,42 105,42 80,62 90,95 60,75 30,95 40,62 15,42 48,42"
                    fill="none" stroke="white" strokeWidth="1.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#stars)" />
            </svg>
          </div>

          <div style={slashStyle} />

          <div
            style={{
              ...artStyle,
              backgroundImage: "none",
            }}
          >
            <img
              src="/persona5_swipe_menu.png"
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                borderRadius: "2px",
              }}
            />
          </div>

          <div style={{ ...ribbonBase, top: "8%", right: "-20px", rotate: "-2deg" }} />
          <div style={{ ...ribbonBase, bottom: "8%", left: "-20px", rotate: "-2deg" }} />
        </div>
      </div>
    </>
  );
}