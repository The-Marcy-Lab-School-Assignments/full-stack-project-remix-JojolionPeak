import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/api";
import { TYPE_ACCENT, MoneySymbol, formatBalance } from "./dashboardUtils";
import CreateTransactionModal from "./CreateTransactionModal";
import TransferModal from "./TransferModal";

const VALID_TYPES    = ["depository", "credit", "loan", "investment", "other"];
const VALID_SUBTYPES = ["checking", "savings", "credit card", "other"];

export default function AccountDetail({ account, onBack, loadDashboard, allAccounts }) {
  const accent = TYPE_ACCENT[account.type] || "#ef4444";

  const [transactions, setTransactions]           = useState([]);
  const [txLoading, setTxLoading]                 = useState(true);
  const [txError, setTxError]                     = useState("");
  const [showTxModal, setShowTxModal]             = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal]         = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingTx, setEditingTx]                 = useState(null);
  const [deleteLoading, setDeleteLoading]         = useState(false);
  const [deleteError, setDeleteError]             = useState("");

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError("");
    try {
      const now     = new Date();
      const year    = now.getFullYear();
      const month   = String(now.getMonth() + 1).padStart(2, "0");
      const from    = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const to      = `${year}-${month}-${lastDay}`;
      const res     = await api.get("/api/transactions", {
        params: { account_id: account.id, from, to, limit: 50 },
      });
      setTransactions(res.data.data);
    } catch {
      setTxError("Failed to load transactions.");
    } finally {
      setTxLoading(false);
    }
  }, [account.id]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const handleDelete = async () => {
    setDeleteError("");
    setDeleteLoading(true);
    try {
      await api.delete(`/api/accounts/${account.id}`);
      loadDashboard();
      onBack();
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Failed to delete account.");
      setDeleteLoading(false);
    }
  };

  const handleDeleteTx = async (txId) => {
    try {
      await api.delete(`/api/transactions/${txId}`);
      loadTransactions();
      loadDashboard();
    } catch {}
  };

  const balance    = account.availableBalance;
  const isNegative = balance < 0;
  const balColor   = isNegative ? "#f87171" : accent;

  return (
    <div>
      <button className="detail-back" onClick={onBack}>
        ← All Accounts
      </button>

      <div
        className="surface detail-hero animate-fade-down"
        style={{ borderLeftColor: accent }}
      >
        <div>
          <p className="eyebrow">{account.institutionName || "Account"}</p>
          <p className="detail-name">{account.accountName}</p>
          {account.mask && (
            <p style={{ fontSize: "0.7rem", color: "var(--color-text-faint)", marginTop: "0.25rem" }}>
              &bull;&bull;&bull;&bull; {account.mask}
            </p>
          )}
        </div>
        <div className="detail-hero-right">
          <p className="detail-balance-label">Balance</p>
          <p className="detail-balance" style={{ color: balColor }}>
            <MoneySymbol color={balColor} />
            {isNegative ? "-" : ""}
            {formatBalance(balance)}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0", flexWrap: "wrap" }}>
        <button className="btn btn-primary" style={{ fontSize: "0.75rem" }}
          onClick={() => setShowTxModal(true)}>
          + Transaction
        </button>
        <button className="btn btn-ghost" style={{ fontSize: "0.75rem" }}
          onClick={() => setShowTransferModal(true)}>
          ⇄ Transfer
        </button>
        <button className="btn btn-ghost" style={{ fontSize: "0.75rem" }}
          onClick={() => setShowEditModal(true)}>
          ✎ Edit
        </button>
        <button
          className="btn btn-ghost"
          style={{ fontSize: "0.75rem", color: "var(--color-error)", borderColor: "var(--color-error-border)" }}
          onClick={() => setShowDeleteConfirm(true)}>
          ✕ Delete
        </button>
      </div>

      <p className="eyebrow" style={{ margin: "1.5rem 0 0.75rem" }}>
        This Month
      </p>

      {txLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1, 0.7, 0.4].map((opacity, i) => (
            <div key={i} className="skeleton" style={{ height: "52px", opacity }} />
          ))}
        </div>
      ) : txError ? (
        <p className="alert-error">{txError}</p>
      ) : transactions.length === 0 ? (
        <p style={{ color: "var(--color-text-faint)", fontSize: "0.8rem", padding: "1rem 0" }}>
          No transactions this month.
        </p>
      ) : (
        <div className="tx-list">
          {transactions.map((tx, i) => {
            const isExpense = tx.type === "expense";
            const amtColor  = isExpense ? "#f87171" : "#4ade80";
            const sign      = isExpense ? "−" : "+";
            return (
              <div
                key={tx.id}
                className="tx-row"
                style={{ animationDelay: `${i * 40}ms`, cursor: "pointer" }}
                onClick={() => setEditingTx(tx)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                  {/* Category icon or fallback dot */}
                  <span style={{
                    fontSize: "1.1rem", lineHeight: 1, flexShrink: 0,
                    opacity: tx.category?.icon ? 1 : 0.3,
                  }}>
                    {tx.category?.icon || "◈"}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="tx-merchant">{tx.merchant || tx.description || "—"}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <p className="tx-date">
                        {tx.date}
                        {tx.status === "pending" && (
                          <span style={{ marginLeft: "0.4rem", color: "#f59e0b", fontSize: "0.6rem", letterSpacing: "0.1em" }}>
                            PENDING
                          </span>
                        )}
                      </p>
                      {/* Category name badge */}
                      {tx.category?.name && (
                        <span style={{
                          fontSize: "0.6rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: tx.category.color || "var(--color-text-faint)",
                          background: tx.category.color
                            ? `${tx.category.color}18`
                            : "rgba(255,255,255,0.05)",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "var(--radius-sm)",
                          whiteSpace: "nowrap",
                        }}>
                          {tx.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                  <p className="tx-amount" style={{ color: amtColor }}>
                    <span style={{ fontSize: "0.85em" }}>{sign}</span>
                    <MoneySymbol color={amtColor} />
                    {formatBalance(Math.abs(tx.amount))}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTx(tx.id); }}
                    style={{
                      background: "none", border: "none",
                      color: "var(--color-text-faint)", cursor: "pointer",
                      fontSize: "0.8rem", padding: "0.25rem",
                      transition: "color var(--transition)",
                    }}
                    onMouseOver={(e) => (e.target.style.color = "var(--color-error)")}
                    onMouseOut={(e)  => (e.target.style.color = "var(--color-text-faint)")}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingTx && (
        <EditTransactionModal
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onUpdated={() => { setEditingTx(null); loadTransactions(); loadDashboard(); }}
        />
      )}

      {showTxModal && (
        <CreateTransactionModal
          accountId={account.id}
          onClose={() => setShowTxModal(false)}
          onCreated={() => { setShowTxModal(false); loadTransactions(); loadDashboard(); }}
        />
      )}

      {showTransferModal && (
        <TransferModal
          account={account}
          allAccounts={allAccounts}
          onClose={() => setShowTransferModal(false)}
          onTransferred={() => { setShowTransferModal(false); loadTransactions(); loadDashboard(); }}
        />
      )}

      {showEditModal && (
        <EditAccountModal
          account={account}
          onClose={() => setShowEditModal(false)}
          onUpdated={() => { setShowEditModal(false); loadDashboard(); }}
        />
      )}

      {showDeleteConfirm && (
        <div className="modal-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <p className="eyebrow">Delete Account</p>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>✕</button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{account.accountName}</strong>?
              Transactions linked to this account will be preserved but unlinked.
            </p>
            {deleteError && <p className="alert-error">{deleteError}</p>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button
                className="btn"
                style={{ background: "var(--color-error)", color: "#fff" }}
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EditTransactionModal ─────────────────────────────────────────────────────

function EditTransactionModal({ tx, onClose, onUpdated }) {
  const formatDate = (d) => (d ? d.split("T")[0] : "");

  const [form, setForm] = useState({
    amount:          String(Math.abs(tx.amount)),
    type:            tx.type            || "expense",
    status:          tx.status          || "complete",
    description:     tx.description     || "",
    merchant:        tx.merchant        || "",
    date:            formatDate(tx.date) || "",
    authorized_date: formatDate(tx.authorizedDate) || "",
    category_id:     tx.category?.id   || "",
  });
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [categories, setCategories]     = useState([]);
  const [catsLoading, setCatsLoading]   = useState(true);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Fetch categories once on mount
  useEffect(() => {
    let cancelled = false;
    api.get("/api/categories")
      .then((res) => { if (!cancelled) setCategories(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCatsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Reset category when type changes to avoid stale cross-type selection
  const handleTypeChange = (t) => {
    setForm((f) => ({ ...f, type: t, category_id: "" }));
  };

  // Filtered list: only show categories matching the current transaction type
  const filteredCategories = categories.filter((c) =>
    c.type === form.type || c.type === "both"
  );

  const handleSubmit = async () => {
    if (!form.amount || !form.type || !form.date) {
      setError("Amount, type, and date are required.");
      return;
    }
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) === 0) {
      setError("Amount must be a non-zero number.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const signedAmount = form.type === "expense"
        ? -Math.abs(parseFloat(form.amount))
        :  Math.abs(parseFloat(form.amount));
      await api.put(`/api/transactions/${tx.id}`, {
        ...form,
        amount: signedAmount,
        category_id: form.category_id || null,
        authorized_date: form.authorized_date || undefined,
      });
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update transaction.");
    } finally {
      setLoading(false);
    }
  };

  const typeBtn = (t, label) => (
    <button
      key={t}
      className="btn"
      onClick={() => handleTypeChange(t)}
      style={{
        flex: 1,
        background:  form.type === t ? (t === "expense" ? "var(--color-error)" : "#4ade80") : "transparent",
        color:       form.type === t ? "#fff" : "var(--color-text-muted)",
        border:      "1px solid",
        borderColor: form.type === t ? (t === "expense" ? "var(--color-error)" : "#4ade80") : "var(--color-border)",
        fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="eyebrow">Edit Transaction</p>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <p className="alert-error">{error}</p>}

        <div className="modal-fields">
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {typeBtn("expense", "− Expense")}
            {typeBtn("income",  "+ Income")}
          </div>

          <input className="input" type="number" placeholder="Amount *" min="0" step="0.01"
            value={form.amount} onChange={(e) => set("amount", e.target.value)} />

          <input className="input" placeholder="Merchant"
            value={form.merchant} onChange={(e) => set("merchant", e.target.value)} />

          <input className="input" placeholder="Description"
            value={form.description} onChange={(e) => set("description", e.target.value)} />

          {/* Category selector */}
          <div>
            <p style={{
              fontSize: "0.65rem", letterSpacing: "0.1em",
              color: "var(--color-text-muted)", textTransform: "uppercase",
              marginBottom: "0.35rem",
            }}>
              Category
            </p>
            {catsLoading ? (
              <div className="input" style={{ opacity: 0.5, pointerEvents: "none" }}>
                Loading categories…
              </div>
            ) : (
              <select
                className="input"
                value={form.category_id}
                onChange={(e) => set("category_id", e.target.value)}
              >
                <option value="">— Uncategorized —</option>
                {filteredCategories.length === 0 ? (
                  <option disabled>No categories for this type</option>
                ) : (
                  filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ""}{c.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="modal-row">
            <div>
              <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>Date *</p>
              <input className="input" type="date" value={form.date}
                onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>Authorized Date</p>
              <input className="input" type="date" value={form.authorized_date}
                onChange={(e) => set("authorized_date", e.target.value)} />
            </div>
          </div>

          <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="complete">Complete</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EditAccountModal ─────────────────────────────────────────────────────────

function EditAccountModal({ account, onClose, onUpdated }) {
  const [form, setForm] = useState({
    account_name:      account.accountName      || "",
    institution_name:  account.institutionName  || "",
    mask:              account.mask             || "",
    type:              account.type             || "depository",
    subtype:           account.subtype          || "",
    current_balance:   account.currentBalance   ?? "",
    available_balance: account.availableBalance ?? "",
  });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.account_name || !form.type) {
      setError("Account name and type are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.patch(`/api/accounts/${account.id}`, form);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="eyebrow">Edit Account</p>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <p className="alert-error">{error}</p>}
        <div className="modal-fields">
          <input className="input" placeholder="Account name *" value={form.account_name}
            onChange={(e) => set("account_name", e.target.value)} />
          <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
            {VALID_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <select className="input" value={form.subtype} onChange={(e) => set("subtype", e.target.value)}>
            {VALID_SUBTYPES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <input className="input" placeholder="Institution name" value={form.institution_name}
            onChange={(e) => set("institution_name", e.target.value)} />
          <input className="input" placeholder="Last 4 digits (mask)" maxLength={4} value={form.mask}
            onChange={(e) => set("mask", e.target.value)} />
          <div className="modal-row">
            <input className="input" type="number" placeholder="Current balance" value={form.current_balance}
              onChange={(e) => set("current_balance", e.target.value)} />
            <input className="input" type="number" placeholder="Available balance" value={form.available_balance}
              onChange={(e) => set("available_balance", e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}