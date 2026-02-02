"use client";

import { useState, useEffect, useCallback } from "react";
import { storage, StockAlert } from "@/lib/storage";
import { invoke } from "@tauri-apps/api/core";

type Tab = "terminal" | "stocks";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("stocks");
  const [messages, setMessages] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);

  // Form State
  const [tickerInput, setTickerInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setMessages((prev) => [...prev, `[${time}] ${message}`]);
  }, []);

  const syncStocks = useCallback(async () => {
    const currentAlerts = storage.getAlerts();
    if (currentAlerts.length === 0) return;

    setIsSyncing(true);
    addLog(`Initiating stock sync for ${currentAlerts.length} tickers...`);

    for (const alert of currentAlerts) {
      try {
        addLog(`Fetching live data for ${alert.ticker} via Backend...`);

        // Calling the Rust backend command
        const price = await invoke<number>("get_stock_price", { ticker: alert.ticker });

        const formattedPrice = parseFloat(price.toFixed(2));
        storage.updateAlertPrice(alert.id, formattedPrice);

        if (formattedPrice >= alert.targetPrice && alert.status !== "triggered") {
          addLog(`ALERT: ${alert.ticker} hit target price of $${alert.targetPrice} (Now: $${formattedPrice})`);
        } else {
          addLog(`Checked ${alert.ticker}: $${formattedPrice}`);
        }
      } catch (err) {
        addLog(`Error syncing ${alert.ticker}: ${typeof err === 'string' ? err : 'Unknown error'}`);
      }
    }

    setAlerts(storage.getAlerts());
    setIsSyncing(false);
    addLog("Sync complete.");
  }, [addLog]);

  // Initial load sync
  useEffect(() => {
    setAlerts(storage.getAlerts());
    syncStocks();
  }, [syncStocks]);

  // Hourly sync
  useEffect(() => {
    const ONE_HOUR = 60 * 60 * 1000;
    const interval = setInterval(() => {
      syncStocks();
    }, ONE_HOUR);
    return () => clearInterval(interval);
  }, [syncStocks]);

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tickerInput || !priceInput) return;
    const alert = storage.saveAlert(tickerInput, parseFloat(priceInput));
    setAlerts([...storage.getAlerts()]);
    addLog(`Added alert for ${alert.ticker} at $${alert.targetPrice}`);
    setTickerInput("");
    setPriceInput("");
    syncStocks();
  };

  const renderTerminal = () => (
    <div className="flex flex-col h-[60vh] animate-in fade-in duration-500">
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-xl p-3 flex gap-2 items-center">
        <div className="w-3 h-3 rounded-full bg-red-500/50" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
        <div className="w-3 h-3 rounded-full bg-green-500/50" />
        <span className="ml-2 text-xs text-zinc-500 font-bold uppercase tracking-widest">Pulse Terminal</span>
      </div>
      <div className="flex-1 bg-zinc-950/50 backdrop-blur-md border-x border-b border-zinc-800 rounded-b-xl p-6 overflow-y-auto space-y-2 font-mono text-sm custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-zinc-600 italic italic tracking-tight">System standby... awaiting signals.</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="flex gap-4">
              <span className="text-zinc-700 select-none">➜</span>
              <span className={msg.includes("ALERT") ? "text-red-400 font-bold" : "text-emerald-500"}>
                {msg}
              </span>
            </div>
          ))
        )}
        <div className="flex items-center gap-2 text-emerald-500">
          <span className="animate-pulse">_</span>
        </div>
      </div>
    </div>
  );

  const renderStocks = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <form onSubmit={handleAddAlert} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ticker</label>
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            placeholder="AAPL, TSLA, etc."
            className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-indigo-500 outline-none transition-all font-bold"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Alert Price ($)</label>
          <input
            type="number"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="500.00"
            className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-indigo-500 outline-none transition-all font-bold"
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95">
            Set Alert +
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-xl font-black uppercase tracking-tighter italic">Active Alerts</h3>
          <button
            onClick={syncStocks}
            disabled={isSyncing}
            className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-zinc-800 transition-all ${isSyncing ? "animate-pulse border-indigo-500 text-indigo-500" : "hover:bg-zinc-800"}`}
          >
            {isSyncing ? "Syncing..." : "Refresh Now ↻"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {alerts.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 italic border border-dashed border-zinc-800 rounded-[2rem]">
              No active alerts. Add a ticker above to start tracking.
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="p-6 rounded-3xl bg-white/5 border border-zinc-800 flex items-center justify-between group hover:border-zinc-700 transition-all">
                <div>
                  <h4 className="text-2xl font-black tracking-tighter">{alert.ticker}</h4>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Target: ${alert.targetPrice.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black font-mono tracking-tighter ${alert.status === "triggered" ? "text-red-500 animate-pulse" : "text-emerald-500"}`}>
                    ${alert.lastPrice || "---"}
                  </p>
                  <p className="text-[8px] text-zinc-600 uppercase font-black tracking-widest">
                    Last Update: {new Date(alert.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-black text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 md:w-64 border-r border-zinc-800 flex flex-col p-4 md:p-8 gap-10 bg-black/50 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4 px-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-xl shadow-lg rotate-3 group cursor-pointer" onClick={syncStocks}>
            <span className="group-hover:rotate-12 transition-transform">⚡</span>
          </div>
          <h1 className="hidden md:block font-black tracking-tighter text-2xl italic">PULSE</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab("stocks")}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === "stocks" ? "bg-zinc-900 text-white shadow-xl" : "text-zinc-500 hover:text-white"}`}
          >
            <span className="text-xl">📈</span>
            <span className="hidden md:block font-black text-xs uppercase tracking-widest">Stocks</span>
          </button>
          <button
            onClick={() => setActiveTab("terminal")}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === "terminal" ? "bg-zinc-900 text-white shadow-xl" : "text-zinc-500 hover:text-white"}`}
          >
            <span className="text-xl">📺</span>
            <span className="hidden md:block font-black text-xs uppercase tracking-widest">Console</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto relative">
        <div className="max-w-4xl mx-auto">
          <header className="mb-12 flex justify-between items-center">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tighter italic">
                {activeTab === "stocks" ? "Market Monitor" : "Pulse System Log"}
              </h2>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mt-1">
                {activeTab === "stocks" ? "Real-time stock alerts & tracking" : "Runtime diagnostic messages"}
              </p>
            </div>
            {isSyncing && (
              <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-widest animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Live Syncing
              </div>
            )}
          </header>

          {activeTab === "stocks" ? renderStocks() : renderTerminal()}
        </div>

        {/* Floating Trigger Button (Always available to add to log) */}
        <button
          onClick={() => addLog("Manual ping received.")}
          className="fixed bottom-6 right-6 w-12 h-12 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full flex items-center justify-center text-xl shadow-2xl active:scale-90 transition-all z-50 group md:bottom-12 md:right-12"
          title="Log Activity"
        >
          <span className="group-hover:rotate-12 transition-transform">✋</span>
        </button>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
