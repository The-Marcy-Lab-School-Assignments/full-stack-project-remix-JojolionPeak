import { useState, useCallback, useRef } from "react";
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

export default function App() {
  const [showLoader, setShowLoader] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const suppressNext = useRef(false);

  const handleLoginSuccess = useCallback(() => setShowLoader(true), []);

  const handleLoaderDone = useCallback(() => {
    setShowLoader(false);
  }, []);

  const handleLogout = useCallback(() => {
    suppressNext.current = true;
    setShowLoader(true);
    navigate("/auth", { replace: true });
  }, [navigate]);

  return (
    <>
      {showLoader && <LoadingScreen onDone={handleLoaderDone} />}

      <RouteTransition location={pathname} isLogoPlaying={showLoader} suppressNext={suppressNext}>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" />} />
          <Route path="/auth" element={<AuthPage onLoginSuccess={handleLoginSuccess} />} />
          <Route path="/dashboard" element={<DashboardPage onLogout={handleLogout} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RouteTransition>
    </>
  );
}