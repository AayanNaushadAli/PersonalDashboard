"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Wallet,
  ShoppingCart,
  BarChart3,
  Eye,
  EyeOff,
  Zap,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  History,
  RefreshCw,
  Shield,
  Crosshair,
  Target,
  Calculator,
  Sigma,
  Route,
  BellRing,
  BellOff,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Calendar, PieChart as PieChartIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const USD_TO_INR = 85;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface EndpointResult {
  endpoint: string;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

interface ApiResponse {
  success: boolean;
  endpoint: string;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error?: string;
}

interface OrderRecord {
  id: number;
  size: number;
  unfilled_size: number;
  side: string;
  order_type: string;
  limit_price: string;
  stop_price: string;
  paid_commission: string;
  commission: string;
  state: string;
  created_at: string;
  updated_at: string;
  product_id: number;
  product_symbol: string;
  average_fill_price?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta_data?: any;
}

interface FillRecord {
  id: number;
  size: number;
  side: string;
  price: string;
  commission: string;
  created_at: string;
  product_id: number;
  product_symbol: string;
  role: string;
  fill_type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta_data?: any;
}

interface WalletTransaction {
  id: number;
  amount: string;
  balance: string;
  transaction_type: string;
  created_at: string;
  asset_id: number;
}

interface EquityPoint {
  date: string;
  balance: number;
}

interface ClosedTrade {
  date: string;
  symbol: string;
  side: string;
  qty: number;
  entryPrice: string;
  exitPrice: string;
  realisedPnlUsd: number;
  feesUsd: number;
  netPnlInr: number;
  orderId: number;
}

type ConnectionStatus = "idle" | "loading" | "success" | "error";

/* ------------------------------------------------------------------ */
/* JSON Syntax Highlighter                                             */
/* ------------------------------------------------------------------ */

function syntaxHighlight(json: string): string {
  const sanitizedJson = json.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return sanitizedJson.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

/* ------------------------------------------------------------------ */
/* Custom Tooltip                                                      */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const usd = payload[0].value as number;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-[10px] text-slate-400 mb-1">{label}</p>
        <p className="text-sm font-semibold text-emerald-400">
          ${usd.toFixed(2)}
        </p>
        <p className="text-xs text-slate-400">
          ₹{(usd * USD_TO_INR).toFixed(0)}
        </p>
      </div>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Helper: call the API proxy                                          */
/* ------------------------------------------------------------------ */

async function callDelta(
  endpoint: string,
  queryParams?: string
): Promise<ApiResponse> {
  const res = await fetch("/api/delta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, queryParams }),
  });
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Helper: paginate through all results                                */
/* ------------------------------------------------------------------ */

async function fetchAllPages(
  endpoint: string,
  baseQuery: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allResults: any[] = [];
  let afterCursor: string | null = null;
  let pages = 0;

  do {
    const parts = [baseQuery, afterCursor ? `after=${afterCursor}` : "", "page_size=100"]
      .filter(Boolean)
      .join("&");
    const q = parts ? `${parts}` : "page_size=100";
    const data = await callDelta(endpoint, q);

    if (data.data?.success && Array.isArray(data.data.result)) {
      allResults = allResults.concat(data.data.result);
      afterCursor = data.data.meta?.after || null;
    } else {
      break;
    }
    pages++;
  } while (afterCursor && pages < 30);

  return allResults;
}

/* ------------------------------------------------------------------ */
/* Timestamp parser — handle Delta's microsecond timestamps            */
/* ------------------------------------------------------------------ */

function parseDeltaTimestamp(ts: string): Date {
  if (!ts) return new Date(0);

  // Delta API returns microsecond timestamps as strings e.g. "1725865012000000"
  const num = Number(ts);

  if (!isNaN(num)) {
    // If it's a big number (>1e15) it's microseconds
    if (num > 1e15) return new Date(num / 1000);
    // If it's in the trillions range it's milliseconds
    if (num > 1e12) return new Date(num);
    // Otherwise it's seconds
    return new Date(num * 1000);
  }

  // ISO string
  return new Date(ts);
}

function formatDate(ts: string): string {
  const d = parseDeltaTimestamp(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateShort(ts: string): string {
  const d = parseDeltaTimestamp(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/* ------------------------------------------------------------------ */
/* Format helpers                                                      */
/* ------------------------------------------------------------------ */

function fmtUsd(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtInr(v: number): string {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function DeltaDashboard() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [results, setResults] = useState<Record<string, EndpointResult>>({});
  const [rawOutput, setRawOutput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const [totalProfit, setTotalProfit] = useState(0);
  const [totalLoss, setTotalLoss] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [netPnl, setNetPnl] = useState(0);

  const [autoPoll, setAutoPoll] = useState(false);
  const lastTradeRef = useRef<number | null>(null);

  /* ---------------------------------------------------------------- */
  /* Test Connection & Refresh                                         */
  /* ---------------------------------------------------------------- */

  const runAll = useCallback(async () => {
    setStatus("loading");
    setResults({});
    setRawOutput("");
    setErrorMessage("");

    // 1. Basic connectivity endpoints
    const newResults: Record<string, EndpointResult> = {};
    let hasError = false;

    for (const ep of ["/v2/wallet/balances", "/v2/orders", "/v2/positions/margined"]) {
      try {
        const data = await callDelta(ep);
        newResults[ep] = { endpoint: ep, status: data.status || 200, data: data.data };
        if (!data.success || !data.data?.success) {
          hasError = true;
          setErrorMessage(data.data?.error?.code || data.error || "API error");
        }
      } catch (err) {
        hasError = true;
        const msg = err instanceof Error ? err.message : "Network error";
        setErrorMessage(msg);
        newResults[ep] = { endpoint: ep, status: 0, data: { error: msg } };
      }
    }

    setResults(newResults);
    setStatus(hasError ? "error" : "success");

    if (newResults["/v2/wallet/balances"]) {
      setRawOutput(JSON.stringify(newResults["/v2/wallet/balances"], null, 2));
    }

    // 2. Fetch history
    if (!hasError) {
      await fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /* Fetch 93-Day History                                              */
  /* ---------------------------------------------------------------- */

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);

    try {
      const now = Date.now();
      const d93 = 93 * 24 * 60 * 60 * 1000;
      const cutoffDate = now - d93;
      const startTime = Math.floor(cutoffDate / 1000);

      // Fetch order history WITHOUT start_time — Delta API's start_time
      // silently excludes some products (e.g. PAXGUSD). We filter client-side.
      const allOrders: OrderRecord[] = await fetchAllPages(
        "/v2/orders/history", ""
      );

      // Process closed orders
      const trades: ClosedTrade[] = [];
      let profit = 0, loss = 0, totalFees = 0;

      for (const order of allOrders) {
        if (order.state !== "closed") continue;

        // Client-side 93-day filter
        const orderDate = new Date(order.updated_at || order.created_at).getTime();
        if (orderDate < cutoffDate) continue;

        const filledQty = order.size - (order.unfilled_size || 0);
        if (filledQty <= 0) continue;

        const comm = parseFloat(order.paid_commission || "0");

        // Sum ALL fees from every closed+filled order (entries + exits)
        totalFees += comm;

        // PnL from meta_data.pnl (confirmed from live API response)
        const pnlStr = order.meta_data?.pnl;
        const pnl = parseFloat(pnlStr || "0");

        // Entry price from meta_data.entry_price, exit from average_fill_price
        const entryPriceRaw = order.meta_data?.entry_price;
        const exitPriceRaw = order.average_fill_price || order.limit_price;

        const entryStr = entryPriceRaw
          ? parseFloat(entryPriceRaw).toLocaleString("en-US", { maximumFractionDigits: 2 })
          : "—";
        const exitStr = exitPriceRaw
          ? parseFloat(exitPriceRaw).toLocaleString("en-US", { maximumFractionDigits: 2 })
          : "—";

        const netPnlUsd = pnl - comm;

        // Use updated_at (fill time) instead of created_at (order placement time)
        trades.push({
          date: formatDate(order.updated_at || order.created_at),
          symbol: order.product_symbol,
          side: order.side === "buy" ? "Buy" : "Sell",
          qty: filledQty,
          entryPrice: entryStr,
          exitPrice: exitStr,
          realisedPnlUsd: pnl,
          feesUsd: comm,
          netPnlInr: netPnlUsd * USD_TO_INR,
          orderId: order.id,
        });

        if (pnl > 0) profit += pnl;
        else if (pnl < 0) loss += Math.abs(pnl);
      }

      if (trades.length > 0) {
        const latestTrade = trades[0];
        // Check for new trades sequentially
        if (lastTradeRef.current && lastTradeRef.current !== latestTrade.orderId) {
           if (Notification.permission === "granted") {
              new Notification("Delta Exchange - Trade Filled", {
                body: `${latestTrade.side} ${latestTrade.symbol} | Net PnL: ${latestTrade.realisedPnlUsd >= 0 ? '+' : ''}$${latestTrade.realisedPnlUsd.toFixed(2)}`,
              });
           }
        }
        lastTradeRef.current = latestTrade.orderId;
      }

      setClosedTrades(trades);
      setTotalProfit(profit);
      setTotalLoss(loss);
      setTotalFees(totalFees);
      setNetPnl(profit - loss - totalFees);

      // Equity curve from wallet transactions
      const txns: WalletTransaction[] = await fetchAllPages(
        "/v2/wallet/transactions", `start_time=${startTime}`
      );

      if (txns.length > 0) {
        const sorted = txns
          .filter((t) => t.balance && t.created_at)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const dayMap: Record<string, number> = {};
        for (const tx of sorted) {
          const day = formatDateShort(tx.created_at);
          dayMap[day] = parseFloat(tx.balance);
        }

        setEquityCurve(
          Object.entries(dayMap).map(([date, balance]) => ({ date, balance }))
        );
      }

      setHistoryLoaded(true);
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      setHistoryLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /* Auto-load on mount & Auto-Polling                                */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    runAll();
  }, [runAll]);

  useEffect(() => {
    if (!autoPoll) return;

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      runAll();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoPoll, runAll]);

  /* ---------------------------------------------------------------- */
  /* Derived Data                                                      */
  /* ---------------------------------------------------------------- */

  const walletData = results["/v2/wallet/balances"]?.data;
  const ordersData = results["/v2/orders"]?.data;
  const positionsData = results["/v2/positions/margined"]?.data;

  let balanceUsd = 0;
  if (walletData?.success && Array.isArray(walletData?.result)) {
    balanceUsd = walletData.result.reduce(
      (s: number, w: { balance: string }) => s + parseFloat(w.balance || "0"), 0
    );
  }
  const balanceInr = balanceUsd * USD_TO_INR;

  const activeOrdersCount = ordersData?.success && Array.isArray(ordersData?.result)
    ? ordersData.result.length : 0;

  const openPosCount = positionsData?.success && Array.isArray(positionsData?.result)
    ? positionsData.result.filter((p: { size: number }) => p.size !== 0).length : 0;

  const isLoading = status === "loading" || historyLoading;

  /* ---------------------------------------------------------------- */
  /* Risk Management Data                                              */
  /* ---------------------------------------------------------------- */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openPositions: any[] = positionsData?.success && Array.isArray(positionsData?.result)
    ? positionsData.result.filter((p: { size: number }) => p.size !== 0)
    : [];

  const activeOrders: any[] = ordersData?.success && Array.isArray(ordersData?.result)
    ? ordersData.result
    : [];

  /* ---------------------------------------------------------------- */
  /* Advanced Visuals Data                                             */
  /* ---------------------------------------------------------------- */

  const assetDistribution = useMemo(() => {
    const dist: Array<{name: string, value: number}> = [];
    let allocated = 0;
    if (openPositions && Array.isArray(openPositions)) {
      openPositions.forEach(p => {
        const margin = parseFloat(p.margin || "0");
        const sym = p.product_symbol || p.product?.symbol || "Unknown";
        const existing = dist.find(d => d.name === sym);
        if (existing) {
          existing.value += margin;
        } else if (margin > 0) {
          dist.push({ name: sym, value: margin });
        }
        allocated += margin;
      });
    }
    const free = Math.max(0, balanceUsd - allocated);
    if (free > 0) {
      dist.push({ name: "Available Margin", value: free });
    }
    return dist;
  }, [openPositions, balanceUsd]);

  const tradeStats = useMemo(() => {
    let totalWinCount = 0;
    let totalLossCount = 0;
    let totalWinUsd = 0;
    let totalLossUsd = 0;

    if (closedTrades && Array.isArray(closedTrades)) {
      closedTrades.forEach(t => {
        const net = t.realisedPnlUsd - t.feesUsd;
        if (net > 0) {
          totalWinCount++;
          totalWinUsd += net;
        } else if (net < 0) {
          totalLossCount++;
          totalLossUsd += Math.abs(net);
        }
      });
    }

    const totalTrades = totalWinCount + totalLossCount;
    const winRate = totalTrades > 0 ? (totalWinCount / totalTrades) * 100 : 0;
    const avgWin = totalWinCount > 0 ? totalWinUsd / totalWinCount : 0;
    const avgLoss = totalLossCount > 0 ? totalLossUsd / totalLossCount : 0;
    const profitFactor = totalLossUsd > 0 ? totalWinUsd / totalLossUsd : (totalWinUsd > 0 ? 999 : 0);

    return { totalTrades, totalWinCount, totalLossCount, winRate, avgWin, avgLoss, profitFactor };
  }, [closedTrades]);

  const heatmapData = useMemo(() => {
    const pnlByDay: Record<string, number> = {};
    if (closedTrades && Array.isArray(closedTrades)) {
      closedTrades.forEach(t => {
        const dStr = t.date.split(",")[0].trim();
        const net = t.realisedPnlUsd - t.feesUsd;
        pnlByDay[dStr] = (pnlByDay[dStr] || 0) + net;
      });
    }

    const days = [];
    const today = new Date();
    for (let i = 92; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dayStr = `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
      
      let pnl = 0;
      const matchKey = Object.keys(pnlByDay).find(k => {
        const normK = k.replace(/^0/, '').toLowerCase();
        const normD = dayStr.replace(/^0/, '').toLowerCase();
        return normK === normD || normK.includes(normD) || normD.includes(normK);
      });
      if (matchKey) pnl = pnlByDay[matchKey];

      days.push({
        dateFull: dayStr,
        dateShort: `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })}`,
        pnl,
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
    return days;
  }, [closedTrades]);

  const mathStats = useMemo(() => {
    let maxDrawdown = 0;
    let peak = -Infinity;
    if (equityCurve && equityCurve.length > 0) {
      equityCurve.forEach(pt => {
        if (pt.balance > peak) peak = pt.balance;
        const dd = peak > 0 ? ((peak - pt.balance) / peak) * 100 : 0;
        if (dd > maxDrawdown) maxDrawdown = dd;
      });
    }

    let meanReturn = 0;
    let sigma = 0;
    let sharpe = 0;

    if (heatmapData && heatmapData.length > 0) {
      const pnlArr = heatmapData.map(d => d.pnl);
      const sum = pnlArr.reduce((a, b) => a + b, 0);
      meanReturn = sum / pnlArr.length;

      const variance = pnlArr.reduce((acc, val) => acc + Math.pow(val - meanReturn, 2), 0) / pnlArr.length;
      sigma = Math.sqrt(variance);

      if (sigma !== 0) {
        sharpe = meanReturn / sigma;
      }
    }

    return { maxDrawdown, sigma, sharpe, meanReturn };
  }, [equityCurve, heatmapData]);

  const recoveryStats = useMemo(() => {
    const TARGET = 500;
    const DAYS_REMAINING = 30; // 30-Day sprint goal
    const gap = Math.max(0, TARGET - balanceUsd);
    const requiredDaily = gap > 0 ? gap / DAYS_REMAINING : 0;

    let winningDays = 0;
    let losingDays = 0;
    let totalWinDayUsd = 0;
    let totalLossDayUsd = 0;

    if (heatmapData && heatmapData.length > 0) {
      heatmapData.forEach(d => {
         if (d.pnl > 0) { winningDays++; totalWinDayUsd += d.pnl; }
         if (d.pnl < 0) { losingDays++; totalLossDayUsd += Math.abs(d.pnl); }
      });
    }

    const avgWinDay = winningDays > 0 ? totalWinDayUsd / winningDays : 0;
    const avgLossDay = losingDays > 0 ? totalLossDayUsd / losingDays : 0;

    const daysToRecover = avgWinDay > 0 ? (avgLossDay / avgWinDay) : 0;

    const projectedDays = mathStats.meanReturn > 0 ? gap / mathStats.meanReturn : -1;

    return { gap, requiredDaily, TARGET, DAYS_REMAINING, avgWinDay, avgLossDay, daysToRecover, projectedDays };
  }, [balanceUsd, heatmapData, mathStats.meanReturn]);

  const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#a855f7", "#ec4899", "#334155", "#0ea5e9"];


  /* ---------------------------------------------------------------- */
  /* JSX                                                               */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Dot pattern */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      {/* ============ HEADER ============ */}
      <header className="relative z-10 border-b border-slate-800/60 backdrop-blur-sm bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Activity className="w-7 h-7 text-emerald-400" />
              {status === "success" && (
                <>
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                </>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight font-[Inter]">
              Delta API<span className="text-slate-500 font-normal"> : Connectivity Status</span>
            </h1>
          </div>

          {status === "idle" && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/50">
              <span className="w-2 h-2 rounded-full bg-slate-500" /> Awaiting Test
            </span>
          )}
          {isLoading && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-300 bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-500/30">
              <Loader2 className="w-3 h-3 animate-spin" /> {historyLoading ? "Loading History…" : "Testing…"}
            </span>
          )}
          {status === "success" && !isLoading && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-500/30 animate-pulse-glow">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-300 bg-red-900/20 px-3 py-1.5 rounded-full border border-red-500/30 animate-pulse-glow-red">
              <XCircle className="w-3.5 h-3.5" /> Error
            </span>
          )}
        </div>
      </header>

      {/* ============ MAIN ============ */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-7">

        {/* ---- REFRESH BUTTON ---- */}
        <section className="animate-fade-in-up flex items-center justify-between bg-slate-900/40 border border-slate-800/40 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-600'}`} />
            <span className="text-xs font-medium text-slate-400">
              {status === "loading" ? "Syncing data..." : status === "success" ? "Real-time data active" : "Connection idle"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
               onClick={() => {
                 if (!autoPoll && Notification.permission === "default") {
                   Notification.requestPermission();
                 }
                 setAutoPoll(!autoPoll);
               }}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${autoPoll ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800/60'}`}
            >
              {autoPoll ? <BellRing className="w-3.5 h-3.5 animate-pulse" /> : <BellOff className="w-3.5 h-3.5" />}
              {autoPoll ? "Polling: 30s" : "Auto-Poll: OFF"}
            </button>
            <button 
              id="refresh-btn"
              type="button" 
              onClick={runAll} 
              disabled={status === "loading"}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium text-xs px-4 py-2 rounded-lg transition-all border border-slate-700/50"
            >
              {status === "loading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync Dashboard
            </button>
          </div>
        </section>

        {/* ---- METRIC CARDS ---- */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Balance — dual currency */}
          <div className="animate-fade-in-up bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-sm cursor-pointer hover:scale-[1.02] transition-all duration-300"
            onClick={() => results["/v2/wallet/balances"] && setRawOutput(JSON.stringify(results["/v2/wallet/balances"], null, 2))}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-slate-800/60 text-emerald-400"><Wallet className="w-5 h-5" /></div>
              {status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-3xl font-bold text-slate-100 font-[Inter] leading-tight">
              {status !== "idle" ? fmtUsd(balanceUsd) : "—"}
            </p>
            <p className="text-base font-semibold text-emerald-400/70 font-[Inter] mt-0.5">
              {status !== "idle" ? fmtInr(balanceInr) : ""}
            </p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-2">Total Balance</p>
            <p className="mt-1 text-[10px] font-mono text-slate-600">GET /v2/wallet/balances</p>
          </div>

          {/* Active Orders */}
          <div className="animate-fade-in-up bg-gradient-to-br from-sky-500/20 to-sky-600/5 border border-sky-500/20 rounded-2xl p-6 backdrop-blur-sm cursor-pointer hover:scale-[1.02] transition-all duration-300"
            style={{ animationDelay: "100ms" }}
            onClick={() => results["/v2/orders"] && setRawOutput(JSON.stringify(results["/v2/orders"], null, 2))}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-slate-800/60 text-sky-400"><ShoppingCart className="w-5 h-5" /></div>
              {status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-3xl font-bold text-slate-100 font-[Inter]">
              {status !== "idle" ? activeOrdersCount : "—"}
            </p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-2">Active Orders</p>
            <p className="mt-1 text-[10px] font-mono text-slate-600">GET /v2/orders</p>
          </div>

          {/* Open Positions */}
          <div className="animate-fade-in-up bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/20 rounded-2xl p-6 backdrop-blur-sm cursor-pointer hover:scale-[1.02] transition-all duration-300"
            style={{ animationDelay: "200ms" }}
            onClick={() => results["/v2/positions/margined"] && setRawOutput(JSON.stringify(results["/v2/positions/margined"], null, 2))}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-slate-800/60 text-amber-400"><BarChart3 className="w-5 h-5" /></div>
              {status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-3xl font-bold text-slate-100 font-[Inter]">
              {status !== "idle" ? openPosCount : "—"}
            </p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-2">Open Positions</p>
            <p className="mt-1 text-[10px] font-mono text-slate-600">GET /v2/positions/margined</p>
          </div>
        </section>

        {/* ---- NET PNL SUMMARY ---- */}
        {historyLoaded && (
          <section className="animate-fade-in-up grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-emerald-500/10 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><TrendingUp className="w-4 h-4" /></div>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total Profit</span>
              </div>
              <p className="text-lg font-bold text-emerald-400 font-[Inter]">{fmtInr(totalProfit * USD_TO_INR)}</p>
              <p className="text-xs text-slate-500">{fmtUsd(totalProfit)}</p>
            </div>
            <div className="bg-slate-900/50 border border-rose-500/10 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400"><TrendingDown className="w-4 h-4" /></div>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total Loss</span>
              </div>
              <p className="text-lg font-bold text-rose-400 font-[Inter]">{fmtInr(totalLoss * USD_TO_INR)}</p>
              <p className="text-xs text-slate-500">{fmtUsd(totalLoss)}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-700/30 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><DollarSign className="w-4 h-4" /></div>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total Fees</span>
              </div>
              <p className="text-lg font-bold text-amber-400 font-[Inter]">{fmtInr(totalFees * USD_TO_INR)}</p>
              <p className="text-xs text-slate-500">{fmtUsd(totalFees)}</p>
            </div>
            <div className={`bg-slate-900/50 border rounded-2xl p-5 backdrop-blur-sm ${netPnl >= 0 ? "border-emerald-500/20" : "border-rose-500/20"}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-lg ${netPnl >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {netPnl >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Net PnL</span>
              </div>
              <p className={`text-lg font-bold font-[Inter] ${netPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {netPnl >= 0 ? "+" : ""}{fmtInr(netPnl * USD_TO_INR)}
              </p>
              <p className="text-xs text-slate-500">{netPnl >= 0 ? "+" : ""}{fmtUsd(netPnl)}</p>
            </div>
          </section>
        )}

        {/* ---- TRADE STATISTICS ---- */}
        {historyLoaded && (
          <section className="animate-fade-in-up">
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                <Target className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-medium text-slate-300">Trade Statistics</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:divide-x divide-slate-800">
                <div className="flex flex-col px-2">
                  <span className="text-[10px] flex items-center gap-1.5 text-slate-500 font-medium uppercase tracking-wider mb-1">Win Rate</span>
                  <span className={`text-xl font-bold font-[Inter] ${tradeStats.winRate >= 50 ? 'text-emerald-400' : (tradeStats.totalTrades > 0 ? 'text-rose-400' : 'text-slate-300')}`}>
                    {tradeStats.totalTrades > 0 ? tradeStats.winRate.toFixed(1) + '%' : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">{tradeStats.totalWinCount}W - {tradeStats.totalLossCount}L</span>
                </div>
                <div className="flex flex-col px-2">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Total Trades</span>
                  <span className="text-xl font-bold font-[Inter] text-slate-200">{tradeStats.totalTrades > 0 ? tradeStats.totalTrades : '—'}</span>
                </div>
                <div className="flex flex-col px-2">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Average Win</span>
                  <span className="text-xl font-bold font-[Inter] text-emerald-400">
                    {tradeStats.avgWin > 0 ? fmtUsd(tradeStats.avgWin) : '—'}
                  </span>
                </div>
                <div className="flex flex-col px-2">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Average Loss</span>
                  <span className="text-xl font-bold font-[Inter] text-rose-400">
                    {tradeStats.avgLoss > 0 ? '-' + fmtUsd(tradeStats.avgLoss) : '—'}
                  </span>
                </div>
                <div className="flex flex-col px-2">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Profit Factor</span>
                  <span className={`text-xl font-bold font-[Inter] ${tradeStats.profitFactor >= 1 ? 'text-emerald-400' : (tradeStats.totalTrades > 0 ? 'text-rose-400' : 'text-slate-300')}`}>
                    {tradeStats.totalTrades > 0 ? (tradeStats.profitFactor > 99 ? 'MAX' : tradeStats.profitFactor.toFixed(2)) : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Gross Profit / Gross Loss</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---- ADVANCED ANALYTICS ROW ---- */}
        {historyLoaded && (
          <section className="animate-fade-in-up grid grid-cols-1 lg:grid-cols-2 gap-4 mt-[-4px]">
            {/* Box 1: Math & Volatility */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                <Calculator className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-slate-300">Math & Volatility</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:divide-x divide-slate-800">
                <div className="flex flex-col px-2">
                  <span className="text-[10px] flex items-center gap-1.5 text-slate-500 font-medium uppercase tracking-wider mb-1">
                    Daily Returns <Sigma className="w-3 h-3 text-slate-400" />
                  </span>
                  <span className="text-xl font-bold font-[Inter] text-slate-200">
                    {mathStats.sigma > 0 ? fmtUsd(mathStats.sigma) : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Avg daily swing</span>
                </div>
                <div className="flex flex-col px-2">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Sharpe Ratio</span>
                  <span className={`text-xl font-bold font-[Inter] ${mathStats.sharpe >= 1 ? 'text-emerald-400' : (mathStats.sharpe > 0 ? 'text-amber-400' : 'text-slate-300')}`}>
                    {mathStats.sigma > 0 ? mathStats.sharpe.toFixed(2) : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Return / Risk</span>
                </div>
                <div className="flex flex-col px-2">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Max Drawdown</span>
                  <span className={`text-xl font-bold font-[Inter] ${mathStats.maxDrawdown > 20 ? 'text-rose-400' : 'text-amber-400'}`}>
                    {mathStats.maxDrawdown > 0 ? '-' + mathStats.maxDrawdown.toFixed(2) + '%' : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Peak drop</span>
                </div>
              </div>
            </div>

            {/* Box 2: Recovery Analytics */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                <Route className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-medium text-slate-300">Recovery Analytics (Target: $500)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:divide-x divide-slate-800">
                <div className="flex flex-col px-2">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Run Rate to $500</span>
                  <span className="text-xl font-bold font-[Inter] text-slate-200">
                    +{fmtUsd(recoveryStats.requiredDaily)}<span className="text-sm font-normal text-slate-500">/day</span>
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Required daily for 30 days</span>
                </div>
                <div className="flex flex-col px-2">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Recovery Rate</span>
                  <span className={`text-xl font-bold font-[Inter] ${recoveryStats.daysToRecover <= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {recoveryStats.daysToRecover > 0 ? recoveryStats.daysToRecover.toFixed(1) + 'x' : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Winning days needed per losing day</span>
                </div>
                <div className="flex flex-col px-2">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Projected Path</span>
                  <span className={`text-xl font-bold font-[Inter] ${recoveryStats.projectedDays > 0 && recoveryStats.projectedDays < 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {recoveryStats.projectedDays > 0 ? Math.ceil(recoveryStats.projectedDays) + ' Days' : 'Never'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Time to $500 at current win rate</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---- EQUITY CURVE ---- */}
        {historyLoaded && equityCurve.length > 0 && (
          <section className="animate-fade-in-up">
            <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-slate-300">Account Equity — Last 93 Days</span>
                </div>
                <span className="text-xs text-slate-500 font-mono">{equityCurve.length} days</span>
              </div>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurve} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "#1e293b" }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} width={55} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2} fill="url(#eqGrad)" dot={false}
                      activeDot={{ r: 4, fill: "#10b981", stroke: "#0f172a", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* ---- ADVANCED VISUALS ---- */}
        {status === "success" && (
          <section className="animate-fade-in-up grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Asset Distribution / Portfolio Allocation */}
            <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm lg:col-span-1 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-medium text-slate-300">Portfolio Distribution</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-6">Capital allocation across margin</p>
              
              <div className="flex-1 flex flex-col justify-center items-center">
                {assetDistribution.length > 0 ? (
                  <>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={assetDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {assetDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.name === "Available Margin" ? "#334155" : PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                            contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", fontSize: "12px", borderRadius: "8px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="w-full mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center">
                      {assetDistribution.map((entry, index) => (
                        <div key={`legend-${index}`} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.name === "Available Margin" ? "#334155" : PIE_COLORS[index % PIE_COLORS.length] }}></div>
                          <span className="text-xs text-slate-400">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500 text-xs italic">No allocation data.</div>
                )}
              </div>
            </div>

            {/* PnL Heatmap */}
            <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm lg:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-slate-300">Daily PnL Heatmap</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-6">Last 93 days performance (weekends marked with a dot)</p>
              
              <div className="overflow-visible pb-2 flex items-center justify-center">
                <div className="flex gap-[3px] min-w-max">
                  {Array.from({ length: Math.ceil(heatmapData.length / 7) }).map((_, colIdx) => (
                    <div key={`hm-col-${colIdx}`} className="flex flex-col gap-[3px]">
                      {heatmapData.slice(colIdx * 7, colIdx * 7 + 7).map((day, rowIdx) => {
                        let bgColor = "bg-slate-800/40"; // Empty/Neutral
                        let hoverBorder = "hover:border-slate-500";
                        if (day.pnl > 0) {
                          // Intensity logic
                          if (day.pnl > 10) bgColor = "bg-emerald-400";
                          else if (day.pnl > 2) bgColor = "bg-emerald-500";
                          else bgColor = "bg-emerald-600";
                          hoverBorder = "hover:border-emerald-300";
                        } else if (day.pnl < 0) {
                          if (day.pnl < -10) bgColor = "bg-rose-400";
                          else if (day.pnl < -2) bgColor = "bg-rose-500";
                          else bgColor = "bg-rose-600";
                          hoverBorder = "hover:border-rose-300";
                        }

                        return (
                          <div 
                            key={`hm-day-${rowIdx}`}
                            className={`w-4 h-4 rounded-[2px] ${bgColor} cursor-default relative group border border-transparent ${hoverBorder} transition-colors`}
                          >
                            {/* Weekend indicator dot */}
                            {day.isWeekend && <div className="absolute top-[2px] right-[2px] w-[2px] h-[2px] rounded-full bg-slate-900/40 pointer-events-none"></div>}
                            
                            {/* Simple tooltip */}
                            <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 border border-slate-600 text-slate-200 text-xs py-1.5 px-3 rounded-lg w-max z-[100] pointer-events-none shadow-xl drop-shadow-2xl">
                              <span className="font-semibold block mb-0.5">{day.dateFull}</span>
                              <span className={day.pnl > 0 ? "text-emerald-400 font-mono" : day.pnl < 0 ? "text-rose-400 font-mono" : "text-slate-400 font-mono"}>
                                {day.pnl !== 0 ? (day.pnl > 0 ? `+$${day.pnl.toFixed(2)}` : `-$${Math.abs(day.pnl).toFixed(2)}`) : "No Trades"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </section>
        )}

        {/* ---- RISK MANAGEMENT ---- */}
        {status === "success" && (openPositions.length > 0 || activeOrders.length > 0) && (
          <section className="animate-fade-in-up space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-slate-300">Risk Management</span>
            </div>

            {/* --- Open Positions Risk --- */}
            {openPositions.map((pos, idx) => {
              const entryPrice = parseFloat(pos.entry_price || "0");
              const markPrice = parseFloat(pos.mark_price || pos.entry_price || "0");
              const liqPrice = parseFloat(pos.liquidation_price || "0");
              const leverage = parseFloat(pos.leverage || "0");
              const posSize = Math.abs(pos.size || 0);
              const posSide = pos.size > 0 ? "Long" : "Short";
              const symbol = pos.product_symbol || pos.product?.symbol || "—";
              const unrealisedPnl = parseFloat(pos.realized_pnl || pos.pnl || "0");
              const margin = parseFloat(pos.margin || "0");

              // Notional value (contracts * 1 USD per contract for inverse perpetuals)
              const notional = posSize; // each contract = $1 on Delta
              const effectiveLeverage = margin > 0 ? notional / margin : leverage;

              // Liquidation proximity: how far is mark from liq, relative to entry→liq distance
              let liqProximityPct = 0;
              if (liqPrice > 0 && entryPrice > 0) {
                if (posSide === "Long") {
                  // Long: liq is below entry, closer to mark = more danger
                  const totalDistance = entryPrice - liqPrice;
                  const currentDistance = markPrice - liqPrice;
                  liqProximityPct = totalDistance > 0 ? Math.max(0, Math.min(100, ((totalDistance - currentDistance) / totalDistance) * 100)) : 0;
                } else {
                  // Short: liq is above entry
                  const totalDistance = liqPrice - entryPrice;
                  const currentDistance = liqPrice - markPrice;
                  liqProximityPct = totalDistance > 0 ? Math.max(0, Math.min(100, ((totalDistance - currentDistance) / totalDistance) * 100)) : 0;
                }
              }
              const liqBarColor = liqProximityPct > 70 ? "bg-red-500" : liqProximityPct > 40 ? "bg-amber-500" : "bg-emerald-500";
              const liqBarGlow = liqProximityPct > 70 ? "shadow-[0_0_12px_rgba(239,68,68,0.4)]" : liqProximityPct > 40 ? "shadow-[0_0_8px_rgba(245,158,11,0.3)]" : "";

              return (
                <div key={`pos-${idx}`} className="bg-slate-900/50 border border-violet-500/15 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
                        <Crosshair className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-200">{symbol}</span>
                        <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded ${posSide === "Long" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                          {posSide}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{posSize} contracts</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Entry Price</p>
                      <p className="text-sm font-mono font-semibold text-slate-200">${entryPrice.toLocaleString(undefined, {minimumFractionDigits: 1})}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Mark Price</p>
                      <p className="text-sm font-mono font-semibold text-sky-400">${markPrice.toLocaleString(undefined, {minimumFractionDigits: 1})}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Leverage</p>
                      <p className="text-sm font-mono font-bold text-amber-400">{effectiveLeverage.toFixed(1)}x</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Unrealised PnL</p>
                      <p className={`text-sm font-mono font-semibold ${unrealisedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {unrealisedPnl >= 0 ? "+" : ""}{fmtUsd(unrealisedPnl)}
                      </p>
                    </div>
                  </div>

                  {/* Liquidation Proximity Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className={`w-3.5 h-3.5 ${liqProximityPct > 70 ? "text-red-400 animate-pulse" : liqProximityPct > 40 ? "text-amber-400" : "text-slate-500"}`} />
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Liquidation Proximity</span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        Liq: <span className="text-red-400 font-semibold">${liqPrice.toLocaleString(undefined, {minimumFractionDigits: 1})}</span>
                      </span>
                    </div>
                    <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${liqBarColor} ${liqBarGlow}`}
                        style={{ width: `${liqProximityPct}%` }}
                      />
                      {/* Current position marker */}
                      <div className="absolute top-0 h-full flex items-center" style={{ left: `${Math.min(liqProximityPct, 97)}%` }}>
                        <div className="w-1 h-4 bg-white/80 rounded-full -mt-0.5" />
                      </div>
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[9px] font-mono text-emerald-500/60">Safe</span>
                      <span className={`text-[10px] font-mono font-semibold ${liqProximityPct > 70 ? "text-red-400" : liqProximityPct > 40 ? "text-amber-400" : "text-emerald-400"}`}>
                        {liqProximityPct.toFixed(1)}% risk
                      </span>
                      <span className="text-[9px] font-mono text-red-500/60">Liquidation</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* --- Active Orders RR Tracker --- */}
            {activeOrders.length > 0 && (
              <div className="bg-slate-900/50 border border-sky-500/15 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
                      <Target className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">Active Orders — Risk:Reward</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{activeOrders.length} orders</span>
                </div>

                <div className="space-y-4">
                  {Object.entries(
                    activeOrders.reduce((acc, ord) => {
                      const sym = ord.product_symbol || ord.product?.symbol || "—";
                      if (!acc[sym]) acc[sym] = [];
                      acc[sym].push(ord);
                      return acc;
                    }, {} as Record<string, any[]>)
                  ).map(([symbol, ordersGroup], idx) => {
                    const orders = ordersGroup as any[];
                    const matchingPos = openPositions.find(p => (p.product_symbol || p.product?.symbol) === symbol);
                    const entryRef = matchingPos ? parseFloat(matchingPos.entry_price || "0") : 0;
                    const posSide = matchingPos ? (matchingPos.size > 0 ? "Long" : "Short") : null;
                    const posSize = matchingPos ? Math.abs(matchingPos.size || 0) : 0;

                    let tpOrder: any = null;
                    let slOrder: any = null;

                    orders.forEach(ord => {
                      const limitPrice = parseFloat(ord.limit_price || "0");
                      const stopPrice = parseFloat(ord.stop_price || "0");
                      const triggerPrice = limitPrice > 0 ? limitPrice : stopPrice;

                      if (entryRef > 0 && triggerPrice > 0 && posSide) {
                        let isTP = false;
                        if (posSide === "Long") {
                          isTP = triggerPrice > entryRef;
                        } else {
                          isTP = triggerPrice < entryRef;
                        }

                        if (isTP) tpOrder = ord;
                        else slOrder = ord;
                      } else {
                        if (limitPrice > 0) tpOrder = ord;
                        else if (stopPrice > 0) slOrder = ord;
                      }
                    });

                    // PnL Estimator
                    const getEstPnl = (targetPrice: number) => {
                      if (!matchingPos || entryRef === 0 || targetPrice === 0) return null;
                      const priceDiff = Math.abs(targetPrice - entryRef);
                      const pctChange = priceDiff / entryRef;
                      
                      const margin = parseFloat(matchingPos.margin || "0");
                      const leverage = parseFloat(matchingPos.leverage || "0");
                      let notional = 0;
                      
                      if (margin > 0 && leverage > 0) {
                        notional = margin * leverage;
                      } else {
                        const multiplier = matchingPos.product?.contract_value ? parseFloat(matchingPos.product.contract_value) : 0.001;
                        notional = posSize * multiplier * entryRef;
                      }
                      return notional * pctChange;
                    };

                    const tpPrice = tpOrder ? parseFloat(tpOrder.limit_price || tpOrder.stop_price || "0") : 0;
                    const slPrice = slOrder ? parseFloat(slOrder.limit_price || slOrder.stop_price || "0") : 0;
                    
                    const tpPnl = getEstPnl(tpPrice);
                    const slPnl = getEstPnl(slPrice);

                    let rrRatio = "—";
                    let rrColor = "text-slate-400";
                    if (tpPrice > 0 && slPrice > 0 && entryRef > 0) {
                      const reward = Math.abs(tpPrice - entryRef);
                      const risk = Math.abs(entryRef - slPrice);
                      if (risk > 0) {
                        const rr = reward / risk;
                        rrRatio = `1:${rr.toFixed(2)}`;
                        rrColor = rr >= 2 ? "text-emerald-400" : rr >= 1 ? "text-amber-400" : "text-rose-400";
                      }
                    } else if (tpPrice > 0) {
                      rrRatio = "TP Only";
                      rrColor = "text-emerald-400";
                    } else if (slPrice > 0) {
                      rrRatio = "SL Only";
                      rrColor = "text-rose-400";
                    }

                    return (
                      <div key={`ord-grp-${idx}`} className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/20">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-700/30 pb-3">
                          <div className="flex items-center gap-2">
                            {posSide && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${posSide === "Long" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                                {posSide}
                              </span>
                            )}
                            <span className="text-sm font-semibold text-slate-200">{symbol}</span>
                          </div>
                          {entryRef > 0 && (
                            <span className="text-xs text-slate-500 font-mono">Avg Entry: ${entryRef.toLocaleString(undefined, {minimumFractionDigits: 1})}</span>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="space-y-3 flex-1 w-full">
                            {/* TP Row */}
                            <div className="flex justify-between items-center sm:pr-6">
                              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider w-20 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Target
                              </span>
                              {tpPrice > 0 ? (
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-mono font-bold text-emerald-400">${tpPrice.toLocaleString()}</span>
                                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded min-w-[70px] text-center border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                    {tpPnl !== null ? `+$${tpPnl.toFixed(2)}` : "—"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs italic text-slate-600">—</span>
                              )}
                            </div>

                            {/* SL Row */}
                            <div className="flex justify-between items-center sm:pr-6">
                              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider w-20 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                Stop
                              </span>
                              {slPrice > 0 ? (
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-mono font-bold text-rose-400">${slPrice.toLocaleString()}</span>
                                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded min-w-[70px] text-center border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                                    {slPnl !== null ? `-$${slPnl.toFixed(2)}` : "—"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs italic text-slate-600">—</span>
                              )}
                            </div>
                          </div>

                          <div className="sm:border-l border-slate-700/30 sm:pl-6 pt-3 sm:pt-0 border-t sm:border-t-0 w-full sm:w-auto flex flex-col items-center justify-center min-w-[90px]">
                            <span className="text-[10px] text-slate-500 uppercase font-medium mb-1">R:R Ratio</span>
                            <span className={`text-base font-mono font-bold ${rrColor}`}>{rrRatio}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ---- PAST TRADES TABLE ---- */}
        {historyLoaded && (
          <section className="animate-fade-in-up">
            <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-medium text-slate-300">Past Trades (Last 93 Days)</span>
                </div>
                <span className="text-xs text-slate-500 font-mono">{closedTrades.length} trades</span>
              </div>

              {closedTrades.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800/40">
                        {["Date", "Asset", "Side", "Qty", "Entry", "Exit", "Realised PnL", "Fees", "Net PnL (₹)"].map((h) => (
                          <th key={h} className={`px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                            ["Qty", "Entry", "Exit", "Realised PnL", "Fees", "Net PnL (₹)"].includes(h) ? "text-right" : ""
                          }`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {closedTrades.slice(0, 100).map((t, i) => (
                        <tr key={`${t.orderId}-${i}`} className="border-b border-slate-800/20 hover:bg-slate-800/20 transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">{t.date}</td>
                          <td className="px-4 py-3 text-xs text-slate-200 font-semibold">{t.symbol}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              t.side === "Buy" || t.side === "Long" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            }`}>{t.side}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300 text-right font-mono">{t.qty}</td>
                          <td className="px-4 py-3 text-xs text-slate-400 text-right font-mono">${t.entryPrice}</td>
                          <td className="px-4 py-3 text-xs text-slate-300 text-right font-mono">${t.exitPrice}</td>
                          <td className={`px-4 py-3 text-xs text-right font-mono font-semibold ${t.realisedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {t.realisedPnlUsd >= 0 ? "+" : ""}{fmtUsd(t.realisedPnlUsd)}
                          </td>
                          <td className="px-4 py-3 text-xs text-amber-400/70 text-right font-mono">{fmtUsd(t.feesUsd)}</td>
                          <td className={`px-4 py-3 text-xs text-right font-mono font-bold ${t.netPnlInr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {t.netPnlInr >= 0 ? "+" : ""}{fmtInr(t.netPnlInr)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {closedTrades.length > 100 && (
                    <div className="px-6 py-3 text-xs text-slate-500 text-center border-t border-slate-800/30">
                      Showing 100 of {closedTrades.length} trades
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-slate-500">No closed trades found in the last 93 days.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---- RAW TERMINAL ---- */}
        <section className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-400">Raw API Response</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
            </div>
            <div className="p-5 max-h-[400px] overflow-auto">
              {rawOutput ? (
                <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-all"
                  dangerouslySetInnerHTML={{ __html: syntaxHighlight(rawOutput) }} />
              ) : (
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <span className="font-mono text-emerald-600/60">$</span>
                  <span className="font-mono">
                    {isLoading ? "Fetching API responses..." : "Click 'Test Connection' or a metric card to view raw JSON here."}
                  </span>
                  {status === "idle" && <span className="w-2 h-4 bg-emerald-500/40 animate-pulse" />}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="relative z-10 border-t border-slate-800/40 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 justify-center">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70" />
          <p className="text-xs text-slate-500">
            Ensure API key is set to <span className="text-amber-400/80 font-medium">{"'View-Only'"}</span> in Delta Settings. Never share your API secret.
          </p>
        </div>
      </footer>
    </div>
  );
}
