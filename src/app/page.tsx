"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

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
  return json.replace(
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
  /* Auto-load on mount                                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    runAll();
  }, [runAll]);

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
