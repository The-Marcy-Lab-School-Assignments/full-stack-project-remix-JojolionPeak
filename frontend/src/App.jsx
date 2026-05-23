import { useState, useCallback, useRef, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import LoadingScreen from "./components/LoadingScreen";
import RouteTransition from "./components/RouteTransition";
import { api } from "./api/api";

export default function App() {
  const [showLoader, setShowLoader] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const suppressNext = useRef(true);
  const pendingNav = useRef(null);

  useEffect(() => {
    api.get("/api/auth/me")
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setAuthed(true);
    pendingNav.current = "/dashboard";
    setShowLoader(true);
  }, []);

  const handleLoaderDone = useCallback(() => {
    setShowLoader(false);
    suppressNext.current = true;
    if (pendingNav.current) {
      navigate(pendingNav.current, { replace: true });
      pendingNav.current = null;
    }
  }, [navigate]);

  const handleLogout = useCallback(() => {
    setAuthed(false);
    pendingNav.current = "/auth";
    setShowLoader(true);
  }, []);

  if (!authChecked) return null;

  return (
    <>
      {showLoader && <LoadingScreen onDone={handleLoaderDone} />}

      <RouteTransition location={pathname} isLogoPlaying={showLoader} suppressNext={suppressNext}>
        <Routes>
          <Route path="/" element={<Navigate to={authed ? "/dashboard" : "/auth"} />} />
          <Route path="/auth" element={<AuthPage onLoginSuccess={handleLoginSuccess} />} />
          <Route
            path="/dashboard"
            element={
              authed
                ? <DashboardPage onLogout={handleLogout} />
                : <Navigate to="/auth" replace />
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RouteTransition>
    </>
  );
}