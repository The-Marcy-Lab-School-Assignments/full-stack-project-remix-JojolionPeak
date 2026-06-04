import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundVideo from "../components/BackgroundVideo";
import { api } from "../api/api";
import { useP5Transition } from "../hooks/useP5Transition";
import P5Overlay from "../components/dashboard/P5Overlay";
import AccountCard from "../components/dashboard/AccountCard";
import AccountDetail from "../components/dashboard/AccountDetail";
import CreateAccountModal from "../components/dashboard/CreateAccountModal";
import EscMenu from "../components/dashboard/EscMenu";
import "./DashboardPage.css";

export default function DashboardPage({ onLogout, navigateWithTransition }) {
  const navigate = useNavigate();

  const [user, setUser]                 = useState(null);
  const [accounts, setAccounts]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEscMenu, setShowEscMenu]   = useState(false);

  // Track which account has its summary panel open (by account ID, or null).
  // Only one panel may be open at a time.
  const [openSummaryId, setOpenSummaryId] = useState(null);

  const { phase, trigger } = useP5Transition();

  const loadDashboard = useCallback(async () => {
    try {
      const [meRes, accountsRes] = await Promise.all([
        api.get("/api/auth/me"),
        api.get("/api/accounts"),
      ]);
      setUser(meRes.data);
      setAccounts(accountsRes.data);
    } catch (err) {
      if (err.response?.status === 401) navigate("/auth", { replace: true });
      else setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") loadDashboard(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", loadDashboard);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", loadDashboard);
    };
  }, [loadDashboard]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setShowEscMenu((prev) => !prev); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSelectAccount = useCallback((account) => {
    trigger(() => setSelectedAccount(account));
  }, [trigger]);

  const handleBackToAccounts = useCallback(() => {
    trigger(() => { setSelectedAccount(null); loadDashboard(); });
  }, [trigger, loadDashboard]);

  const handleLogout = async () => {
    try { await api.post("/api/auth/logout"); } catch {}
    finally { onLogout?.(); }
  };

  /**
   * Toggle the summary panel for a given account.
   * Opening a new panel automatically closes the previously open one.
   */
  const handleToggleSummary = useCallback((accountId) => {
    setOpenSummaryId((prev) => (prev === accountId ? null : accountId));
  }, []);

  const firstName = user?.displayName?.split(" ")[0] || "there";

  return (
    <div className="page">
      <BackgroundVideo />
      <P5Overlay phase={phase} />
      <div className="esc-hint">Press ESC for menu</div>

      <div className="page-content">
        <header className="dashboard-header animate-fade-down">
          <div>
            <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>Dashboard</p>
            <h1 className="header-greeting">Welcome back, <em>{firstName}</em></h1>
          </div>
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="header-avatar"
              onClick={() => setShowEscMenu(true)}
              style={{ cursor: "pointer" }}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="header-avatar-placeholder"
            onClick={() => setShowEscMenu(true)}
            style={{ cursor: "pointer", display: user?.avatarUrl ? "none" : "flex" }}
          >
            {firstName.charAt(0).toUpperCase()}
          </div>
        </header>

        <main className="dashboard-main">
          {selectedAccount ? (
            <AccountDetail
              account={accounts.find((a) => a.id === selectedAccount.id) || selectedAccount}
              onBack={handleBackToAccounts}
              loadDashboard={loadDashboard}
              allAccounts={accounts}
            />
          ) : (
            <>
              <p className="eyebrow animate-fade-down" style={{ marginBottom: "1.25rem" }}>
                Your Accounts
              </p>

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {[1, 0.7, 0.4].map((opacity, i) => (
                    <div key={i} className="skeleton" style={{ height: "88px", opacity }} />
                  ))}
                </div>
              ) : error ? (
                <p className="alert-error">{error}</p>
              ) : accounts.length === 0 ? (
                <div className="empty-state">No accounts yet — add one below</div>
              ) : (
                <div className="accounts-list">
                  {accounts.map((account, i) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      index={i}
                      onClick={() => handleSelectAccount(account)}
                      summaryOpen={openSummaryId === account.id}
                      onToggleSummary={() => handleToggleSummary(account.id)}
                    />
                  ))}
                </div>
              )}

              <button className="btn-add-account" onClick={() => setShowCreateModal(true)}>
                + Add Account
              </button>

              <button
                className="btn-categories"
                onClick={() => navigateWithTransition("/categories")}
              >
                ◈ Manage Categories
              </button>
            </>
          )}
        </main>
      </div>

      {showCreateModal && (
        <CreateAccountModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadDashboard(); }}
        />
      )}

      {showEscMenu && (
        <EscMenu
          user={user}
          onClose={() => setShowEscMenu(false)}
          onLogout={handleLogout}
          onUserUpdated={(updated) => {
            setUser((prev) => ({ ...prev, ...updated }));
            setShowEscMenu(false);
          }}
        />
      )}

      <footer style={{
        position: "fixed",
        bottom: "1.5rem",
        left: 0,
        right: "8rem",
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