import { useState } from "react";
import { api } from "../../api/api";

const ACCOUNT_TYPES    = ["depository", "credit", "loan", "investment", "other"];
const ACCOUNT_SUBTYPES = ["checking", "savings", "credit card", "other"];

export default function CreateAccountModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    account_name: "", type: "depository", subtype: "checking",
    institution_name: "", mask: "", current_balance: "", available_balance: "",
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
      await api.post("/api/accounts", form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="eyebrow">New Account</p>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <p className="alert-error">{error}</p>}

        <div className="modal-fields">
          <input className="input" placeholder="Account name *" value={form.account_name}
            onChange={(e) => set("account_name", e.target.value)} />
          <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <select className="input" value={form.subtype} onChange={(e) => set("subtype", e.target.value)}>
            {ACCOUNT_SUBTYPES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <input className="input" placeholder="Institution name" value={form.institution_name}
            onChange={(e) => set("institution_name", e.target.value)} />
          <input className="input" placeholder="Last 4 digits (mask)" maxLength={4} value={form.mask}
            onChange={(e) => set("mask", e.target.value)} />
          <div className="modal-row">
            <input className="input" placeholder="Current balance" type="number" value={form.current_balance}
              onChange={(e) => set("current_balance", e.target.value)} />
            <input className="input" placeholder="Available balance" type="number" value={form.available_balance}
              onChange={(e) => set("available_balance", e.target.value)} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}