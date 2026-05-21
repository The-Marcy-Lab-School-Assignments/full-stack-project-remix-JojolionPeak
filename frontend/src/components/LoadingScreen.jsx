import { useEffect, useState } from "react";

/**
 * LoadingScreen
 * Floats the Phantom Thieves logo over the current page with no background.
 * mix-blend-mode: multiply makes the white parts of the image transparent
 * so only the red/black logo art shows through.
 *
 * Total duration: ~1200ms
 *   - 0–150ms:   logo pops in
 *   - 150–900ms: holds
 *   - 900–1200ms: fades out → onDone fires
 */
export default function LoadingScreen({ onDone }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const holdTimer = setTimeout(() => setExiting(true), 900);
    const doneTimer = setTimeout(() => onDone(), 1200);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
    }}>
      <img
        src="/logo.png"
        alt=""
        style={{
          width: "clamp(120px, 22vw, 220px)",
          animation: exiting
            ? "ls-fade-out 0.3s ease forwards"
            : "ls-logo-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          filter: "drop-shadow(0 0 24px rgba(239,68,68,0.7))",
        }}
      />

      <style>{`
        @keyframes ls-fade-out {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(1.08); }
        }
        @keyframes ls-logo-pop {
          from { opacity: 0; transform: scale(0.78); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}