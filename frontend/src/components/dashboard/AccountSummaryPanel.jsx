import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../api/api";
import { formatBalance, MoneySymbol } from "./dashboardUtils";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { value: "week",    label: "Weekly" },
  { value: "month",   label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year",    label: "Yearly" },
  { value: "custom",  label: "Custom Range" },
];

const TIMEFRAME_LABELS = {
  week:    "week",
  month:   "month",
  quarter: "quarter",
  year:    "year",
};

// ─── SVG Pie Chart ────────────────────────────────────────────────────────────

/**
 * Pure SVG pie chart. No external dependencies.
 *
 * Slices are drawn as SVG <path> arcs. A minimum slice angle of 4° is enforced
 * so tiny categories remain visible. The center shows a total value.
 */
function PieChart({ data, size = 160, label }) {
  const cx     = size / 2;
  const cy     = size / 2;
  const radius = size * 0.38;
  const inner  = size * 0.22; 

  const [hovered, setHovered] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={radius - inner}
          />
          <text
            x={cx} y={cy}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.08}
            fill="rgba(255,255,255,0.25)"
            fontFamily="'DM Mono', monospace"
          >
            No data
          </text>
        </svg>
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-faint)", margin: 0 }}>
          {label}
        </p>
      </div>
    );
  }

  // Calculate total and enforce minimum slice angle
  const total = data.reduce((s, d) => s + d.total, 0);
  const MIN_ANGLE = 4 * (Math.PI / 180);

  // First pass: compute raw angles
  let slices = data.map((d) => ({
    ...d,
    angle: (d.total / total) * 2 * Math.PI,
  }));

  // Second pass: enforce minimum angle, then normalize so sum = 2π
  slices = slices.map((s) => ({ ...s, angle: Math.max(s.angle, MIN_ANGLE) }));
  const angleSum = slices.reduce((s, sl) => s + sl.angle, 0);
  slices = slices.map((s) => ({ ...s, angle: (s.angle / angleSum) * 2 * Math.PI }));

  // Build arc paths
  const polarToCartesian = (angle) => ({
    x: cx + radius * Math.cos(angle - Math.PI / 2),
    y: cy + radius * Math.sin(angle - Math.PI / 2),
  });

  const innerPolar = (angle) => ({
    x: cx + inner * Math.cos(angle - Math.PI / 2),
    y: cy + inner * Math.sin(angle - Math.PI / 2),
  });

  let currentAngle = 0;
  const paths = slices.map((slice, i) => {
    const startAngle = currentAngle;
    const endAngle   = currentAngle + slice.angle;
    currentAngle     = endAngle;

    const largeArc = slice.angle > Math.PI ? 1 : 0;

    const outerStart = polarToCartesian(startAngle);
    const outerEnd   = polarToCartesian(endAngle);
    const innerStart = innerPolar(startAngle);
    const innerEnd   = innerPolar(endAngle);

    const d = [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      "Z",
    ].join(" ");

    const isHovered = hovered === i;

    return (
      <path
        key={i}
        d={d}
        fill={slice.color || "#94a3b8"}
        opacity={hovered !== null && !isHovered ? 0.4 : 1}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1"
        style={{
          transition: "opacity 0.2s ease, transform 0.15s ease",
          cursor: "pointer",
          transformOrigin: `${cx}px ${cy}px`,
          transform: isHovered ? "scale(1.04)" : "scale(1)",
        }}
        onMouseEnter={() => setHovered(i)}
        onMouseLeave={() => setHovered(null)}
      />
    );
  });

  const hoveredSlice = hovered !== null ? slices[hovered] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ position: "relative" }}>
        <svg
          width={size} height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: "visible" }}
        >
          {paths}

          {/* Centre label */}
          {hoveredSlice ? (
            <>
              <text
                x={cx} y={cy - size * 0.05}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={size * 0.1}
                fill="white"
                fontFamily="'DM Serif Display', serif"
                fontStyle="italic"
              >
                {hoveredSlice.percentage?.toFixed(1)}%
              </text>
              <text
                x={cx} y={cy + size * 0.09}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={size * 0.075}
                fill="rgba(255,255,255,0.6)"
                fontFamily="'DM Mono', monospace"
              >
                ¥{formatBalance(hoveredSlice.total)}
              </text>
            </>
          ) : (
            <>
              <text
                x={cx} y={cy - size * 0.04}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={size * 0.085}
                fill="rgba(255,255,255,0.5)"
                fontFamily="'DM Mono', monospace"
                letterSpacing="0.05em"
              >
                TOTAL
              </text>
              <text
                x={cx} y={cy + size * 0.08}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={size * 0.1}
                fill="white"
                fontFamily="'DM Serif Display', serif"
                fontStyle="italic"
              >
                ¥{formatBalance(total)}
              </text>
            </>
          )}
        </svg>
      </div>

      <p style={{
        fontSize: "0.65rem", letterSpacing: "0.12em",
        textTransform: "uppercase", color: "var(--color-text-faint)",
        margin: 0, textAlign: "center",
      }}>
        {label}
      </p>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function PieLegend({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "0.4rem",
      width: "100%", maxWidth: "200px",
    }}>
      {data.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "2px", flexShrink: 0,
            background: item.color || "#94a3b8",
          }} />
          <span style={{
            fontSize: "0.7rem", color: "var(--color-text-muted)",
            flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {item.icon ? `${item.icon} ` : ""}{item.name}
          </span>
          <span style={{
            fontSize: "0.7rem", color: "var(--color-text-faint)",
            fontFamily: "var(--font-mono)", flexShrink: 0,
          }}>
            {item.percentage?.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, change, color, isExpense }) {
  const changePositive = isExpense ? change < 0 : change > 0;
  const changeColor    = change === null ? "var(--color-text-faint)"
                       : changePositive  ? "#4ade80"
                       : "#f87171";
  const arrow          = change === null ? "" : change > 0 ? "↑" : "↓";

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      padding: "0.85rem 1rem",
      display: "flex", flexDirection: "column", gap: "0.35rem",
    }}>
      <p style={{
        fontSize: "0.6rem", letterSpacing: "0.15em",
        textTransform: "uppercase", color: "var(--color-text-faint)", margin: 0,
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "var(--font-display)", fontSize: "1.2rem",
        fontStyle: "italic", color: color || "var(--color-text)",
        margin: 0, letterSpacing: "-0.01em",
      }}>
        ¥{formatBalance(Math.abs(value ?? 0))}
      </p>
      {change !== null && change !== undefined && (
        <p style={{ fontSize: "0.65rem", color: changeColor, margin: 0 }}>
          {arrow} {Math.abs(change).toFixed(1)}% vs prev period
        </p>
      )}
    </div>
  );
}

// ─── Comparison Period Label ──────────────────────────────────────────────────

function ComparisonLabel({ previous, timeframe, isCustom }) {
  if (!previous) return null;

  const fmt = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  let description;
  if (isCustom) {
    description = `Comparing against ${fmt(previous.from)} – ${fmt(previous.to)}`;
  } else {
    const labels = {
      week:    "previous week",
      month:   "previous month",
      quarter: "previous quarter",
      year:    "previous year",
      day:     "previous day",
    };
    description = `Comparing against ${labels[timeframe] || "previous period"} (${fmt(previous.from)} – ${fmt(previous.to)})`;
  }

  return (
    <p style={{
      fontSize: "0.65rem", color: "var(--color-text-faint)",
      letterSpacing: "0.06em", margin: "0 0 0.75rem 0",
      borderLeft: "2px solid var(--color-accent)",
      paddingLeft: "0.6rem",
    }}>
      {description}
    </p>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AccountSummaryPanel({ account, isOpen }) {
  const [timeframe, setTimeframe]     = useState("month");
  const [customFrom, setCustomFrom]   = useState("");
  const [customTo, setCustomTo]       = useState("");
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const abortRef                      = useRef(null);

  const isCustom = timeframe === "custom";

  // ── Fetch summary data ────────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    if (!isOpen) return;
    if (isCustom && (!customFrom || !customTo)) return;
    if (isCustom && new Date(customFrom) > new Date(customTo)) return;

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError("");

    try {
      let summaryRes, categoryRes;

      if (isCustom) {
        // Use the range endpoint which returns both current and previous in one call
        const res = await api.get("/api/summary/range", {
          params: { from: customFrom, to: customTo, account_id: account.id },
          signal: abortRef.current.signal,
        });
        setData({ type: "custom", payload: res.data });
        return;
      }

      // Standard timeframe: fetch summary + by-category in parallel
      [summaryRes, categoryRes] = await Promise.all([
        api.get("/api/summary", {
          params: { timeframe, account_id: account.id },
          signal: abortRef.current.signal,
        }),
        api.get("/api/summary/by-category", {
          params: { timeframe, account_id: account.id },
          signal: abortRef.current.signal,
        }),
      ]);

      // For previous period category breakdown, fetch separately
      // We need to compute previous dates — easier to just use the range endpoint
      // with the previous period dates from the summary response.
      const prev = summaryRes.data.previous;
      let prevCategoryRes = { data: { categories: [] } };

      if (prev?.from && prev?.to) {
        prevCategoryRes = await api.get("/api/summary/range", {
          params: {
            from: prev.from,
            to:   prev.to,
            account_id: account.id,
          },
          signal: abortRef.current.signal,
        });
      }

      setData({
        type:    "standard",
        payload: {
          summary:            summaryRes.data,
          categories:         categoryRes.data.categories,
          previousCategories: prevCategoryRes.data.byCategory || [],
        },
      });
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      setError("Failed to load summary.");
    } finally {
      setLoading(false);
    }
  }, [isOpen, timeframe, isCustom, customFrom, customTo, account.id]);

  // Fetch whenever panel opens or timeframe changes
  useEffect(() => {
    if (isOpen) fetchSummary();
  }, [fetchSummary, isOpen]);

  // Clean up abort controller on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const summary        = data?.type === "standard" ? data.payload.summary     : null;
  const currentCats    = data?.type === "standard" ? data.payload.categories   : data?.payload?.byCategory   || [];
  const previousCats   = data?.type === "standard" ? data.payload.previousCategories : data?.payload?.previous?.byCategory || [];
  const previousPeriod = data?.type === "standard" ? summary?.previous        : data?.payload?.previous;

  const totalExpenses    = data?.type === "standard"
    ? summary?.current?.totalExpenses
    : data?.payload?.totalExpenses;
  const totalIncome      = data?.type === "standard"
    ? summary?.current?.totalIncome
    : data?.payload?.totalIncome;
  const netFlow          = data?.type === "standard"
    ? summary?.current?.netFlow
    : data?.payload?.netSavings;
  const expensePctChange = data?.type === "standard" ? summary?.expensePercentChange : null;
  const incomePctChange  = data?.type === "standard" ? summary?.incomePercentChange  : null;

  const currentLabel  = isCustom
    ? `${customFrom} – ${customTo}`
    : `This ${TIMEFRAME_LABELS[timeframe] || timeframe}`;
  const previousLabel = previousPeriod
    ? `${previousPeriod.from} – ${previousPeriod.to}`
    : "Previous period";

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      style={{
        overflow: "hidden",
        animation: "slideUp 0.3s ease forwards",
        marginTop: "0.5rem",
      }}
    >
      <div style={{
        background: "rgba(0,0,0,0.6)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{
            fontSize: "0.6rem", letterSpacing: "0.15em",
            textTransform: "uppercase", color: "var(--color-text-faint)",
            flexShrink: 0,
          }}>
            Period
          </span>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                style={{
                  background:   timeframe === tf.value ? "var(--color-accent)" : "transparent",
                  color:        timeframe === tf.value ? "#fff" : "var(--color-text-muted)",
                  border:       `1px solid ${timeframe === tf.value ? "var(--color-accent)" : "var(--color-border)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding:      "0.3rem 0.65rem",
                  fontSize:     "0.7rem",
                  fontFamily:   "var(--font-mono)",
                  letterSpacing:"0.06em",
                  cursor:       "pointer",
                  transition:   "all var(--transition)",
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {isCustom && (
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-faint)" }}>
                From
              </label>
              <input
                type="date"
                className="input"
                style={{ fontSize: "0.8rem", padding: "0.5rem 0.75rem" }}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-faint)" }}>
                To
              </label>
              <input
                type="date"
                className="input"
                style={{ fontSize: "0.8rem", padding: "0.5rem 0.75rem" }}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 0.7, 0.4].map((opacity, i) => (
              <div key={i} className="skeleton" style={{ height: "60px", opacity, borderRadius: "var(--radius-md)" }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="alert-error">{error}</p>
        )}

        {!loading && !error && isCustom && (!customFrom || !customTo) && (
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-faint)", textAlign: "center", padding: "1rem 0" }}>
            Select a start and end date to view summary.
          </p>
        )}

        {!loading && !error && data && !(isCustom && (!customFrom || !customTo)) && (
          <>
            <ComparisonLabel
              previous={previousPeriod}
              timeframe={timeframe}
              isCustom={isCustom}
            />

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "0.65rem",
            }}>
              <StatCard
                label="Expenses"
                value={totalExpenses}
                change={expensePctChange}
                color="#f87171"
                isExpense={true}
              />
              <StatCard
                label="Income"
                value={totalIncome}
                change={incomePctChange}
                color="#4ade80"
                isExpense={false}
              />
              <StatCard
                label="Net Flow"
                value={netFlow}
                change={null}
                color={netFlow >= 0 ? "#4ade80" : "#f87171"}
              />
            </div>

            {(currentCats.length > 0 || previousCats.length > 0) && (
              <div>
                <p style={{
                  fontSize: "0.6rem", letterSpacing: "0.15em",
                  textTransform: "uppercase", color: "var(--color-text-faint)",
                  margin: "0 0 1rem 0",
                }}>
                  Spending by Category
                </p>

                <div style={{
                  display: "flex",
                  gap: "2rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  alignItems: "flex-start",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                    <PieChart
                      data={currentCats}
                      size={160}
                      label={currentLabel}
                    />
                    <PieLegend data={currentCats} />
                  </div>

                  <div style={{
                    width: "1px",
                    background: "var(--color-border)",
                    alignSelf: "stretch",
                    minHeight: "100px",
                    flexShrink: 0,
                  }} />

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                    <PieChart
                      data={previousCats}
                      size={160}
                      label={previousLabel}
                    />
                    <PieLegend data={previousCats} />
                  </div>
                </div>
              </div>
            )}

            {currentCats.length === 0 && previousCats.length === 0 && (
              <p style={{
                fontSize: "0.8rem", color: "var(--color-text-faint)",
                textAlign: "center", padding: "0.5rem 0",
              }}>
                No categorized transactions for this period.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}