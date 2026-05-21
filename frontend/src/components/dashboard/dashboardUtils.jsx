export const SUBTYPE_ICONS = {
    checking:      "◈",
    savings:       "◇",
    "credit card": "◻",
    investment:    "◈",
    loan:          "◻",
  };
  
  export const TYPE_ACCENT = {
    depository: "#ef4444",
    credit:     "#f97316",
    investment: "#a3e635",
    loan:       "#fb923c",
    other:      "#94a3b8",
  };
  
  export function MoneySymbol({ color }) {
    return <span className="money-symbol" style={{ color }}>¥</span>;
  }
  
  export function formatBalance(balance) {
    return Math.abs(balance ?? 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }