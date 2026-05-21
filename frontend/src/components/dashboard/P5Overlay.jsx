const SLIDE_DURATION = 380;

/**
 * P5Overlay
 * The full-screen Persona 5 panel that slides in and out.
 */
export default function P5Overlay({ phase }) {
  const isVisible = phase !== "idle";

  return (
    <div
      aria-hidden="true"
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        9999,
        overflow:      "hidden",
        pointerEvents: isVisible ? "all" : "none",
      }}
    >
      <div
        style={{
          position:   "absolute",
          inset:      0,
          display:    "flex",
          alignItems: "stretch",
          transform:
            phase === "idle"       ? "translateX(-110%)"
            : phase === "slide-in" ? "translateX(0%)"
            :                        "translateX(110%)",
          transition:
            phase === "idle"
              ? "none"
              : `transform ${SLIDE_DURATION}ms cubic-bezier(0.7,0,0.3,1)`,
          willChange: "transform",
        }}
      >
        <div style={{ flex: "0 0 50%", background: "#c0161b", position: "relative", overflow: "hidden" }}>
          <svg
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.08 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="p5-diag" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="24" stroke="white" strokeWidth="6" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#p5-diag)" />
          </svg>
          <div style={{
            position: "absolute", bottom: "10%", left: "50%",
            transform: "translateX(-50%)",
            color: "white", fontFamily: "'Arial Black', Impact, sans-serif",
            fontSize: "clamp(12px, 3vw, 22px)", letterSpacing: "0.35em",
            textTransform: "uppercase", fontStyle: "italic",
            whiteSpace: "nowrap", opacity: 0.9,
          }}>
            Persona 5
          </div>
        </div>

        <div style={{ flex: "0 0 50%", background: "#0e0e0e", position: "relative", overflow: "hidden" }}>
          <svg
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="p5-stars" width="110" height="110" patternUnits="userSpaceOnUse">
                <polygon
                  points="55,9 66,38 96,38 73,56 82,85 55,67 28,85 37,56 14,38 44,38"
                  fill="none" stroke="white" strokeWidth="1.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#p5-stars)" />
          </svg>
          <div style={{ position: "absolute", width: "200px", height: "7px", background: "#c0161b", top: "10%", right: "-20px", transform: "rotate(-2deg)" }} />
          <div style={{ position: "absolute", width: "200px", height: "7px", background: "#c0161b", bottom: "10%", left: "-20px", transform: "rotate(-2deg)" }} />
        </div>

        <div style={{
          position:  "absolute", top: 0, left: "50%",
          width:     "7px", height: "100%",
          background: "white",
          transform: "translateX(-50%) skewX(-6deg)",
          zIndex:    10,
        }} />

        <div style={{
          position:    "absolute",
          top:         "50%", left: "50%",
          transform:   "translate(-50%, -50%) rotate(-2deg)",
          width:       "min(80vw, 340px)",
          aspectRatio: "3 / 4.2",
          zIndex:      20,
          filter:      "drop-shadow(0 0 20px rgba(0,0,0,0.9))",
        }}>
          <img
            src="/persona5_swipe_menu.png"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "2px" }}
          />
        </div>
      </div>
    </div>
  );
}