import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import BackgroundVideo from "../components/BackgroundVideo";

export default function AuthPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError("");
    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && !form.displayName) {
      setError("Display name is required.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await api.post("api/auth/login", {
          email: form.email,
          password: form.password,
        });
      } else {
        await api.post("api/auth/signup", {
          displayName: form.displayName,
          email: form.email,
          password: form.password,
        });
      }
      onLoginSuccess?.();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:3000/auth/google";
  };

  return (
    <div className="page">
      <BackgroundVideo />
      <div
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
              Personal Finance
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 400,
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {mode === "login" ? "Welcome back" : "Get started"}
            </h1>
          </div>

          <div
            className="surface"
            style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {error && <p className="alert-error">{error}</p>}

            {mode === "signup" && (
              <input
                className="input"
                placeholder="Display name"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
              />
            )}
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />

            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>

            <div className="divider">or</div>

            <button
              className="btn btn-ghost"
              style={{ width: "100%" }}
              onClick={handleGoogleLogin}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: "0.8rem",
              color: "var(--color-text-muted)",
            }}
          >
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              style={{
                background: "none",
                border: "none",
                color: "var(--color-accent)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8rem",
                padding: 0,
              }}
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setForm({ displayName: "", email: "", password: "" });
              }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
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