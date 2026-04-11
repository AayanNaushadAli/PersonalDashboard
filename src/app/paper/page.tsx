"use client";

import Link from "next/link";
import { useState, useCallback, useMemo, useRef } from "react";
import {
  Activity,
  TrendingUp,
  ArrowUpRight,
  Target,
  Calculator,
  Calendar,
  Upload,
  FileText,
  ArrowLeft,
  Sun,
  Moon,
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

interface PaperTrade {
  time: string;
  balanceBefore: number;
  balanceAfter: number;
  pnl: number;
  currency: string;
  action: string;
  symbol: string;
  side: string;
  price: number;
  qty: number;
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */

export default function PaperTradingPage() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme
  const toggleDarkMode = useCallback(() => {
    const html = document.documentElement;
    const newDark = !darkMode;
    if (newDark) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setDarkMode(newDark);
  }, [darkMode]);

  // Initialize theme from localStorage
  useState(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setDarkMode(isDark);
    }
  });

  /* ---------------------------------------------------------------- */
  /* CSV Parsing                                                       */
  /* ---------------------------------------------------------------- */

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return;

    const parsed: PaperTrade[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { row.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      row.push(current.trim());

      if (row.length < 6) continue;

      const actionStr = row[5] || "";
      const sideMatch = actionStr.match(/Close (long|short) position/i);
      const symbolMatch = actionStr.match(/symbol (\S+)/i);
      const priceMatch = actionStr.match(/at price ([\d.]+)/i);
      const qtyMatch = actionStr.match(/for ([\d.]+) units/i);

      parsed.push({
        time: row[0],
        balanceBefore: parseFloat(row[1]) || 0,
        balanceAfter: parseFloat(row[2]) || 0,
        pnl: parseFloat(row[3]) || 0,
        currency: row[4] || "USD",
        action: actionStr,
        symbol: symbolMatch ? symbolMatch[1].replace("BINANCE:", "") : "Unknown",
        side: sideMatch ? (sideMatch[1].toLowerCase() === "long" ? "Long" : "Short") : "—",
        price: priceMatch ? parseFloat(priceMatch[1]) : 0,
        qty: qtyMatch ? parseFloat(qtyMatch[1]) : 0,
      });
    }

    setTrades(parsed.reverse());
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) parseCSV(text);
    };
    reader.readAsText(file);
  }, [parseCSV]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* ---------------------------------------------------------------- */
  /* Computed Analytics                                                 */
  /* ---------------------------------------------------------------- */

  const equityCurve = useMemo(() => {
    if (trades.length === 0) return [];
    const points = [{ date: "Start", balance: trades[0].balanceBefore }];
    trades.forEach((t) => {
      const d = new Date(t.time);
      points.push({
        date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        balance: t.balanceAfter
      });
    });
    return points;
  }, [trades]);

  const stats = useMemo(() => {
    if (trades.length === 0) return null;
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + Math.abs(t.pnl), 0) / losses.length : 0;
    const totalWinUsd = wins.reduce((s, t) => s + t.pnl, 0);
    const totalLossUsd = losses.reduce((s, t) => s + Math.abs(t.pnl), 0);
    const profitFactor = totalLossUsd > 0 ? totalWinUsd / totalLossUsd : (totalWinUsd > 0 ? 999 : 0);
    const startBal = trades[0].balanceBefore;
    const endBal = trades[trades.length - 1].balanceAfter;
    const returnPct = startBal > 0 ? ((endBal - startBal) / startBal) * 100 : 0;

    // Max drawdown
    let peak = startBal;
    let maxDD = 0;
    trades.forEach(t => {
      if (t.balanceAfter > peak) peak = t.balanceAfter;
      const dd = peak > 0 ? ((peak - t.balanceAfter) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
    });

    // Streak
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempStreak = 0;
    let lastDir = 0;
    trades.forEach(t => {
      const dir = t.pnl > 0 ? 1 : t.pnl < 0 ? -1 : 0;
      if (dir === lastDir && dir !== 0) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
      if (dir > 0 && tempStreak > maxWinStreak) maxWinStreak = tempStreak;
      if (dir < 0 && tempStreak > maxLossStreak) maxLossStreak = tempStreak;
      lastDir = dir;
      currentStreak = tempStreak * dir;
    });

    return {
      totalPnl, totalPnlInr: totalPnl * USD_TO_INR, winRate, avgWin, avgLoss, profitFactor,
      wins: wins.length, losses: losses.length, total: trades.length,
      startBal, endBal, returnPct, maxDD, maxWinStreak, maxLossStreak, currentStreak
    };
  }, [trades]);

  const heatmap = useMemo(() => {
    if (trades.length === 0) return [];
    const pnlByDay: Record<string, number> = {};
    trades.forEach(t => {
      const d = new Date(t.time);
      const key = d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
      pnlByDay[key] = (pnlByDay[key] || 0) + t.pnl;
    });

    const dates = trades.map(t => new Date(t.time));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const days = [];
    const current = new Date(minDate);
    while (current <= maxDate) {
      const key = current.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
      days.push({
        dateFull: key,
        dateShort: current.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        pnl: pnlByDay[key] || 0,
        isWeekend: current.getDay() === 0 || current.getDay() === 6
      });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [trades]);

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(135deg, var(--gradient-from), var(--gradient-via), var(--gradient-to))` }}>
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Background blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] pointer-events-none" style={{ background: 'var(--blob-1)', mixBlendMode: 'var(--blend-mode)' as any }} />
      <div className="fixed bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] pointer-events-none" style={{ background: 'var(--blob-2)', mixBlendMode: 'var(--blend-mode)' as any }} />

      {/* Dot pattern */}
      <div className="fixed inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: `radial-gradient(circle, var(--dot-color) 1px, transparent 1px)`, backgroundSize: "24px 24px" }} />

      {/* ============ HEADER ============ */}
      <header className="relative z-10 glass-card border-b border-[var(--divider)]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
            <Link href="/" className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-medium">Dashboard</span>
            </Link>
            <div className="w-px h-5 bg-[var(--divider)]" />
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--text-accent)]" />
              <h1 className="text-base font-semibold text-[var(--text-primary)]">Paper Trading Analytics</h1>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg transition-all hover:scale-110"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
          >
            {darkMode
              ? <Sun className="w-4 h-4 text-[var(--text-accent)]" />
              : <Moon className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
        </div>
      </header>

      {/* ============ MAIN ============ */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Upload Area */}
        <div
          className={`glass-card-strong rounded-2xl p-10 shadow-lg text-center cursor-pointer transition-all
            ${isDragging ? "border-2 border-[var(--green)] bg-[var(--green)]/5 scale-[1.01]" : "border-2 border-dashed border-[var(--divider)]"}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-2xl transition-all ${isDragging ? "bg-[var(--green)]/20 scale-110" : "bg-[var(--text-accent)]/10"}`}>
              <Upload className={`w-8 h-8 ${isDragging ? "text-[var(--green)]" : "text-[var(--text-accent)]"}`} />
            </div>
            <div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {fileName ? `📄 ${fileName}` : "Upload Paper Trading CSV"}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {trades.length > 0
                  ? `${trades.length} trades loaded • Drop a new CSV to replace`
                  : "Drag & drop your TradingView paper trading balance history CSV"}
              </p>
              <p className="text-[10px] text-[var(--text-faint)] mt-3 font-mono">
                Format: Time, Balance Before, Balance After, Realized P&L, Currency, Action
              </p>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {trades.length === 0 && (
          <div className="glass-card rounded-2xl p-16 text-center">
            <Activity className="w-10 h-10 text-[var(--text-faint)] mx-auto mb-4" />
            <p className="text-sm text-[var(--text-muted)]">Upload a CSV to see your paper trading analytics</p>
            <p className="text-xs text-[var(--text-faint)] mt-2">Export from TradingView → Paper Trading → Balance History</p>
          </div>
        )}

        {/* Analytics */}
        {trades.length > 0 && stats && (
          <>
            {/* ---- TOP SUMMARY CARDS ---- */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total PnL */}
              <div className="glass-card rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-[var(--green)]/10">
                    <TrendingUp className="w-3.5 h-3.5 text-[var(--green)]" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Total PnL</span>
                </div>
                <p className={`text-2xl font-bold font-mono ${stats.totalPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                  {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}
                </p>
                <p className="text-xs text-[var(--text-faint)] font-mono mt-1">
                  ₹{stats.totalPnlInr.toFixed(0)} • {stats.returnPct >= 0 ? "+" : ""}{stats.returnPct.toFixed(1)}%
                </p>
              </div>

              {/* Win Rate */}
              <div className="glass-card rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-[var(--text-accent)]/10">
                    <Target className="w-3.5 h-3.5 text-[var(--text-accent)]" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Win Rate</span>
                </div>
                <p className={`text-2xl font-bold font-mono ${stats.winRate >= 50 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                  {stats.winRate.toFixed(1)}%
                </p>
                <p className="text-xs text-[var(--text-faint)] font-mono mt-1">
                  {stats.wins}W / {stats.losses}L of {stats.total}
                </p>
              </div>

              {/* Avg Win / Loss */}
              <div className="glass-card rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-[var(--green)]/10">
                    <ArrowUpRight className="w-3.5 h-3.5 text-[var(--green)]" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Avg Win / Loss</span>
                </div>
                <p className="text-xl font-bold font-mono text-[var(--green)]">+${stats.avgWin.toFixed(2)}</p>
                <p className="text-xs font-mono text-[var(--red)] mt-1">-${stats.avgLoss.toFixed(2)}</p>
              </div>

              {/* Profit Factor */}
              <div className="glass-card rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-[var(--text-accent)]/10">
                    <Calculator className="w-3.5 h-3.5 text-[var(--text-accent)]" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Profit Factor</span>
                </div>
                <p className={`text-2xl font-bold font-mono ${stats.profitFactor >= 1 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                  {stats.profitFactor >= 999 ? "∞" : stats.profitFactor.toFixed(2)}
                </p>
                <p className="text-xs text-[var(--text-faint)] font-mono mt-1">
                  ${stats.startBal.toFixed(0)} → ${stats.endBal.toFixed(0)}
                </p>
              </div>
            </div>

            {/* ---- SECONDARY STATS ROW ---- */}
            <div className="grid grid-cols-3 gap-4">
              <div className="glass-card-subtle rounded-xl p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Max Drawdown</p>
                <p className="text-lg font-bold font-mono text-[var(--red)]">{stats.maxDD.toFixed(1)}%</p>
              </div>
              <div className="glass-card-subtle rounded-xl p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Best Streak</p>
                <p className="text-lg font-bold font-mono text-[var(--green)]">{stats.maxWinStreak}W</p>
              </div>
              <div className="glass-card-subtle rounded-xl p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Worst Streak</p>
                <p className="text-lg font-bold font-mono text-[var(--red)]">{stats.maxLossStreak}L</p>
              </div>
            </div>

            {/* ---- EQUITY CURVE ---- */}
            <div className="glass-card-strong rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">Equity Curve</span>
                <span className="text-xs text-[var(--text-faint)] font-mono ml-auto">{trades.length} trades</span>
              </div>
              <p className="text-[10px] text-[var(--text-faint)] mb-4">Balance progression from ${stats.startBal.toFixed(0)} to ${stats.endBal.toFixed(0)}</p>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurve} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="paperEquityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--green)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" strokeOpacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-faint)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-faint)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} domain={["dataMin - 5", "dataMax + 5"]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--bg-glass-strong)", borderColor: "var(--divider)", fontSize: "12px", borderRadius: "8px", backdropFilter: "blur(12px)" }}
                      formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Balance"]}
                    />
                    <Area type="monotone" dataKey="balance" stroke="var(--green)" strokeWidth={2} fill="url(#paperEquityGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ---- HEATMAP ---- */}
            {heatmap.length > 0 && (
              <div className="glass-card-strong rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Daily PnL Heatmap</span>
                </div>
                <p className="text-[10px] text-[var(--text-faint)] mb-6">Performance across {heatmap.length} days</p>
                <div className="overflow-x-auto pb-4 pt-4 sm:pt-0 flex sm:justify-center w-full">
                  <div className="flex gap-1 min-w-max px-2">
                    {Array.from({ length: Math.ceil(heatmap.length / 7) }).map((_, colIdx) => (
                      <div key={`pt-col-${colIdx}`} className="flex flex-col gap-1">
                        {heatmap.slice(colIdx * 7, colIdx * 7 + 7).map((day, rowIdx) => {
                          let bgColor = "bg-[var(--bg-secondary)]";
                          let hoverBorder = "hover:border-[#c9b59c]";
                          if (day.pnl > 0) {
                            if (day.pnl > 10) bgColor = "bg-[var(--green)]";
                            else if (day.pnl > 2) bgColor = "bg-[#6aad8b]";
                            else bgColor = "bg-[#8bc4a5]";
                            hoverBorder = "hover:border-[#4c9972]";
                          } else if (day.pnl < 0) {
                            if (day.pnl < -10) bgColor = "bg-[var(--red)]";
                            else if (day.pnl < -2) bgColor = "bg-[#c9766e]";
                            else bgColor = "bg-[#d9928b]";
                            hoverBorder = "hover:border-[#b95a50]";
                          }
                          return (
                            <div
                              key={`pt-day-${rowIdx}`}
                              className={`w-[42px] h-8 flex items-center justify-center rounded-sm ${bgColor} cursor-default relative group border border-transparent ${hoverBorder} transition-colors`}
                            >
                              {bgColor !== "bg-[var(--bg-secondary)]" && (
                                <span className="text-[10px] font-mono font-bold text-white/90 pointer-events-none drop-shadow-md tracking-tighter">
                                  {Number(day.pnl.toFixed(1))}$
                                </span>
                              )}
                              {day.isWeekend && <div className="absolute top-[2px] right-[2px] w-1 h-1 rounded-full bg-black/30 pointer-events-none"></div>}
                              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity glass-card-strong !bg-[var(--bg-base)]/90 text-[var(--text-primary)] text-xs py-1.5 px-3 rounded-lg w-max z-[100] pointer-events-none shadow-xl">
                                <span className="font-semibold block mb-0.5">{day.dateFull}</span>
                                <span className={day.pnl > 0 ? "text-[var(--green)] font-mono" : day.pnl < 0 ? "text-[var(--red)] font-mono" : "text-[var(--text-muted)] font-mono"}>
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
            )}

            {/* ---- TRADE LOG TABLE ---- */}
            <div className="glass-card rounded-2xl overflow-hidden shadow-lg">
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-b border-[var(--divider)]/30 gap-3 sm:gap-0">
                <div className="flex items-center gap-2 w-full justify-center sm:justify-start">
                  <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Trade Log</span>
                  <span className="text-xs text-[var(--text-faint)] font-mono">{trades.length} trades</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--divider)]/30">
                      {["Date", "Symbol", "Side", "Qty", "Close Price", "PnL ($)", "PnL (₹)", "Balance"].map((h) => (
                        <th key={h} className={`px-4 py-3 text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap ${["Qty", "Close Price", "PnL ($)", "PnL (₹)", "Balance"].includes(h) ? "text-right" : ""}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...trades].reverse().map((t, idx) => (
                      <tr key={`pt-row-${idx}`} className="border-b border-[var(--divider)]/10 hover:bg-[var(--bg-glass-hover)]/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-[var(--text-muted)] font-mono whitespace-nowrap">
                          {new Date(t.time).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-primary)] font-semibold">{t.symbol}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${t.side === "Long" ? "bg-[var(--green)]/10 text-[var(--green)]" : t.side === "Short" ? "bg-[var(--red)]/10 text-[var(--red)]" : ""}`}>{t.side}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-secondary)] text-right font-mono">{t.qty}</td>
                        <td className="px-4 py-3 text-xs text-[var(--text-muted)] text-right font-mono">${t.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className={`px-4 py-3 text-xs font-mono text-right font-semibold ${t.pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                          {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 text-xs font-mono text-right ${t.pnl >= 0 ? "text-[var(--green)]/70" : "text-[var(--red)]/70"}`}>
                          {t.pnl >= 0 ? "+" : ""}₹{(t.pnl * USD_TO_INR).toFixed(0)}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-secondary)] text-right font-mono">${t.balanceAfter.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="relative z-10 border-t border-[var(--divider)]/40 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-center gap-2">
          <FileText className="w-3.5 h-3.5 text-[var(--text-accent)]" />
          <p className="text-xs text-[var(--text-muted)]">
            Paper Trading Analytics • Data is processed client-side only — nothing is uploaded to any server.
          </p>
        </div>
      </footer>
    </div>
  );
}
