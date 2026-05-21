import { TYPE_ACCENT, SUBTYPE_ICONS, MoneySymbol, formatBalance } from "./dashboardUtils";

export default function AccountCard({ account, index, onClick }) {
  const accent = TYPE_ACCENT[account.type] || "#ef4444";
  const icon = SUBTYPE_ICONS[account.subtype] || "◈";
  const balance = account.availableBalance;
  const isNegative = balance < 0;
  const color = isNegative ? "#f87171" : accent;

  return (
    <div
      className="account-card"
      style={{ animationDelay: `${index * 80}ms` }}
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
  );
}