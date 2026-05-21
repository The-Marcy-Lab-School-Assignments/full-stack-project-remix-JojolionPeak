import { useState } from "react";
import { api } from "../../api/api";

export default function TransferModal({ account, allAccounts, onClose, onTransferred }) {
  const otherAccounts = allAccounts.filter((a) => a.id !== account.id);

  const [toAccountId, setToAccountId] = useState(otherAccounts[0]?.id || "");
  const [amount, setAmount]           = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep]               = useState("form");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  const toAccount = allAccounts.find((a) => a.id === toAccountId);

  const handleReview = () => {
    setError("");
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { setError("Enter a valid amount greater than zero."); return; }
    if (!toAccountId)           { setError("Select a destination account."); return; }
    setStep("confirm");
  };

  const handleConfirm = async () => {
    setError("");
    setLoading(true);
    const parsed = parseFloat(amount);
    const desc   = description.trim() || undefined;
    const today  = new Date().toISOString().split("T")[0];

    try {
      await Promise.all([
        api.post("/api/transactions", {
          amount: -parsed, type: "expense", status: "complete",
          merchant: `Transfer to ${toAccount.accountName}`,
          description: desc, account_id: account.id, date: today,
        }),
        api.post("/api/transactions", {
          amount: parsed, type: "income", status: "complete",
          merchant: `Transfer from ${account.accountName}`,
          description: desc, account_id: toAccountId, date: today,
        }),
      ]);
      onTransferred();
    } catch (err) {
      setError(err.response?.data?.error || "Transfer failed.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  if (otherAccounts.length === 0) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <p className="eyebrow">Transfer Funds</p>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            You need at least one other account to transfer to.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const label = (text) => (
    <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>{text}</p>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="eyebrow">Transfer Funds</p>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <p className="alert-error">{error}</p>}

        {step === "form" && (
          <>
            <div className="modal-fields">
              <div>
                {label("From")}
                <div className="input" style={{ opacity: 0.6, cursor: "default" }}>
                  {account.accountName}{account.mask ? ` ···· ${account.mask}` : ""}
                </div>
              </div>
              <div>
                {label("To")}
                <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                  {otherAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.accountName}{a.mask ? ` ···· ${a.mask}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                {label("Amount *")}
                <input className="input" type="number" placeholder="0.00" min="0.01" step="0.01"
                  value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <input className="input" placeholder="Description (optional)" value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReview()} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleReview}>Review Transfer</button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="surface" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>Confirm Transfer</p>
              <p style={{ fontSize: "1rem", color: "var(--color-text)", lineHeight: "1.6" }}>
                Transfer{" "}
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
                  ¥{parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>{" "}
                from <strong>{account.accountName}</strong> to <strong>{toAccount?.accountName}</strong>?
              </p>
              {description && (
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Note: {description}</p>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setStep("form")}>Back</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
                {loading ? "Transferring..." : "Confirm Transfer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}