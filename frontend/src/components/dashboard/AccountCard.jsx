import { TYPE_ACCENT, SUBTYPE_ICONS, MoneySymbol, formatBalance } from "./dashboardUtils";
import AccountSummaryPanel from "./AccountSummaryPanel";

export default function AccountCard({ account, index, onClick, summaryOpen, onToggleSummary }) {
  const accent     = TYPE_ACCENT[account.type] || "#ef4444";
  const icon       = SUBTYPE_ICONS[account.subtype] || "◈";
  const balance    = account.availableBalance;
  const isNegative = balance < 0;
  const color      = isNegative ? "#f87171" : accent;

  return (
    <div
      className="account-card"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSummary();
          }}
          title={summaryOpen ? "Hide summary" : "Show summary"}
          style={{
            flexShrink:   0,
            width:        "36px",
            background:   summaryOpen ? "var(--color-accent-dim)" : "transparent",
            border:       `1px solid ${summaryOpen ? "var(--color-accent)" : "var(--color-border)"}`,
            borderRadius: "var(--radius-md)",
            color:        summaryOpen ? "var(--color-accent)" : "var(--color-text-faint)",
            cursor:       "pointer",
            display:      "flex",
            flexDirection:"column",
            alignItems:   "center",
            justifyContent:"center",
            gap:          "0.2rem",
            transition:   "all var(--transition)",
            padding:      "0.5rem 0",
          }}
          onMouseEnter={(e) => {
            if (!summaryOpen) {
              e.currentTarget.style.borderColor = "var(--color-accent)";
              e.currentTarget.style.color       = "var(--color-accent)";
            }
          }}
          onMouseLeave={(e) => {
            if (!summaryOpen) {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.color       = "var(--color-text-faint)";
            }
          }}
        >
          <svg
            width="14" height="12"
            viewBox="0 0 14 12"
            fill="currentColor"
            style={{ flexShrink: 0 }}
          >
            <rect x="0"  y="6"  width="3" height="6" rx="1" />
            <rect x="5"  y="3"  width="3" height="9" rx="1" />
            <rect x="10" y="0"  width="3" height="12" rx="1" />
          </svg>
          <span style={{ fontSize: "0.5rem", lineHeight: 1, letterSpacing: 0 }}>
            {summaryOpen ? "▲" : "▼"}
          </span>
        </button>

        <div
          style={{ flex: 1, cursor: "pointer" }}
          onClick={onClick}
        >
          <div className="card-inner surface">
            <div className="card-strip" style={{ background: accent }} />
            <div className="card-body">
              <div className="card-top">
                <div>
                  <p className="card-institution">{account.institutionName || "—"}</p>
                  <p className="card-name">{account.accountName}</p>
                </div>
                <span className="card-icon" style={{ color: accent }}>{icon}</span>
              </div>
              <div className="card-bottom">
                <div className="card-meta">
                  <span className="card-subtype">{account.subtype || account.type}</span>
                  {account.mask && <span className="card-mask">•••• {account.mask}</span>}
                </div>
                <p className="card-balance" style={{ color }}>
                  <MoneySymbol color={color} />
                  {isNegative ? "-" : ""}
                  {formatBalance(balance)}
                </p>
              </div>
            </div>
            <div className="card-chevron">›</div>
          </div>
        </div>
      </div>

      <AccountSummaryPanel
        account={account}
        isOpen={summaryOpen}
      />
    </div>
  );
}