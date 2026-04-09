"use client";

import { useState, useEffect } from "react";
import { Lock, LayoutDashboard, Wallet, Activity, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

export default function VirtualTradePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Trade State
  const [balance, setBalance] = useState(100.0);
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [trades, setTrades] = useState<any[]>([]);

  // Load from local storage on mount
  
  const fetchDB = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch("/api/virtual/trades");
      const data = await res.json();
      if (data.success) {
         setBalance(data.balance);
         setTrades(data.trades);
      }
    } catch (e) {}
  };

  useEffect(() => {
    const auth = localStorage.getItem("virtual_auth");
    if (auth === "true") setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
        fetchDB();
        const interval = setInterval(fetchDB, 3000);
        return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/virtual/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        localStorage.setItem("virtual_auth", "true");
      } else {
        setError(data.error || "Incorrect PIN");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("virtual_auth");
  };

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(price);
    const s = parseFloat(size);
    if (!p || !s || p <= 0 || s <= 0) return;

    await fetch("/api/virtual/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, price: p, size: s })
    });

    await fetchDB();
    setPrice("");
    setSize("");
  };

  const handleReset = async () => {
    if (confirm("Reset virtual database to $100 and clear all trades?")) {
      await fetch("/api/virtual/reset", { method: "POST" });
      await fetchDB();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Virtual Trade</h1>
            <p className="text-slate-400 text-sm text-center">Restricted access area.</p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-center text-lg text-white tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button
              type="submit"
              disabled={isLoading || !pin}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Verifying..." : "Unlock"}
            </button>
            <Link href="/" className="block text-center text-slate-500 text-sm mt-4 hover:text-slate-300">
              Return to Main Dashboard
            </Link>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800/60 bg-slate-950 p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
               <Activity className="w-5 h-5" />
             </div>
             <h1 className="font-bold text-lg">Virtual Trade <span className="text-slate-500 font-normal">| Simulation</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white text-sm flex items-center gap-2 transition-colors">
               <LayoutDashboard className="w-4 h-4" /> Main Dashboard
            </Link>
            <button onClick={handleLogout} className="text-xs bg-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-700">Lock</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                   <Wallet className="w-4 h-4" /> Available Cash
                 </h2>
                 <button onClick={handleReset} className="text-[10px] text-slate-500 hover:text-red-400 transition-colors uppercase">Reset</button>
               </div>
               <p className={`text-4xl font-bold font-[Inter] ${balance >= 100 ? 'text-emerald-400' : 'text-slate-100'}`}>
                 ${balance.toFixed(2)}
               </p>
               <div className="mt-4 text-xs text-slate-500 border-t border-slate-800 pt-4">
                 Starting Balance: $100.00
               </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-3">Place Trade</h2>
              <form onSubmit={handleTrade} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Symbol</label>
                  <input type="text" value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 uppercase" placeholder="BTC" required />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                   <button type="button" onClick={() => setSide("buy")} className={`py-2 rounded-lg text-sm font-medium transition-colors ${side === 'buy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>Buy</button>
                   <button type="button" onClick={() => setSide("sell")} className={`py-2 rounded-lg text-sm font-medium transition-colors ${side === 'sell' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>Sell</button>
                </div>

                <div>
                  <label className="text-xs text-slate-500 block mb-1">Price (USD)</label>
                  <input type="number" step="any" min="0.000001" value={price} onChange={e=>setPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="0.00" required />
                </div>

                <div>
                  <label className="text-xs text-slate-500 block mb-1">Size (Tokens)</label>
                  <input type="number" step="any" min="0.000001" value={size} onChange={e=>setSize(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="0.00" required />
                </div>
                
                <div className="pt-2">
                  <button type="submit" className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${side === 'buy' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>
                    {side === "buy" ? "Buy" : "Sell"} {symbol || "Token"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="md:col-span-2">
             <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-full">
               <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-3">Trade History</h2>
               
               {trades.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                   <Activity className="w-12 h-12 mb-4 opacity-20" />
                   <p>No virtual trades yet.</p>
                   <p className="text-xs mt-1">Execute a trade to see it here.</p>
                 </div>
               ) : (
                 <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                     <thead className="text-[10px] text-slate-500 uppercase bg-slate-950/50">
                       <tr>
                         <th className="px-4 py-3 rounded-l-lg">Date</th>
                         <th className="px-4 py-3">Side</th>
                         <th className="px-4 py-3">Symbol</th>
                         <th className="px-4 py-3">Size</th>
                         <th className="px-4 py-3">Price</th>
                         <th className="px-4 py-3 rounded-r-lg text-right">Notional</th>
                       </tr>
                     </thead>
                     <tbody>
                       {trades.map((t) => (
                         <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                           <td className="px-4 py-4 text-xs text-slate-400 whitespace-nowrap">{t.date}</td>
                           <td className="px-4 py-4">
                             <span className={`flex items-center gap-1 font-medium ${t.side === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                               {t.side === 'buy' ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                               {t.side.toUpperCase()}
                             </span>
                           </td>
                           <td className="px-4 py-4 font-semibold items-center flex gap-2">
                               {t.symbol} 
                               {t.is_bot && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30 uppercase tracking-widest font-bold">AI BOT</span>}
                           </td>
                           <td className="px-4 py-4 font-mono">{t.size}</td>
                           <td className="px-4 py-4 font-mono">${t.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                           <td className="px-4 py-4 font-mono text-right text-slate-300">
                             ${t.notional.toLocaleString(undefined, {minimumFractionDigits: 2})}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
