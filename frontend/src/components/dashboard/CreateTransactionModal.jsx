import { useState } from "react";
import { api } from "../../api/api";

export default function CreateTransactionModal({ accountId, onClose, onCreated }) {
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    amount: "", type: "expense", status: "complete",
    description: "", merchant: "", date: today, authorized_date: "",
  });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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

      await api.post("/api/transactions", {
        ...form,
        amount: signedAmount,
        account_id: accountId,
        authorized_date: form.authorized_date || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create transaction.");
    } finally {
      setLoading(false);
    }
  };

  const typeBtn = (t, label) => (
    <button
      key={t}
      className="btn"
      onClick={() => set("type", t)}
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
          <p className="eyebrow">New Transaction</p>
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

          <div className="modal-row">
            <div>
              <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>Date *</p>
              <input className="input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>Authorized Date</p>
              <input className="input" type="date" value={form.authorized_date} onChange={(e) => set("authorized_date", e.target.value)} />
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
            {loading ? "Adding..." : "Add Transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}