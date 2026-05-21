import { useNavigate } from "react-router-dom";
import BackgroundVideo from "../components/BackgroundVideo";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <BackgroundVideo />
      <div
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <p className="eyebrow">Error 404</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem, 10vw, 7rem)",
            fontWeight: 400,
            lineHeight: 1,
            margin: 0,
            color: "var(--color-accent)",
          }}
        >
          404
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
          Page not found.
        </p>
        <button className="btn btn-ghost" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </button>
      </div>
      <footer style={{
        position: "fixed",
        bottom: "1.5rem",
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: "0.65rem",
        letterSpacing: "0.08em",
        zIndex: 20,
        pointerEvents: "none",
      }}>
        © <span style={{ color: "var(--color-accent)" }}>Mementos</span>{" "}
        <span style={{ color: "var(--color-text)" }}>2026</span>
      </footer>
    </div>
  );
}