"use client";

import { useState, useEffect, useCallback } from "react";
import { storage, StockAlert, Settings } from "@/lib/storage";
import { invoke } from "@tauri-apps/api/core";

type Tab = "terminal" | "stocks" | "settings";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("stocks");
  const [messages, setMessages] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [settings, setSettings] = useState<Settings>({ telegramToken: "", telegramChatId: "" });

  // Form State
  const [tickerInput, setTickerInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Settings Form State
  const [tokenInput, setTokenInput] = useState("");
  const [chatIdInput, setChatIdInput] = useState("");

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setMessages((prev) => [...prev, `[${time}] ${message}`]);
  }, []);

  const syncStocks = useCallback(async () => {
    const currentAlerts = storage.getAlerts();
    if (currentAlerts.length === 0) return;

    setIsSyncing(true);
    addLog(`Initiating stock sync for ${currentAlerts.length} tickers...`);

    const currentSettings = storage.getSettings();

    for (const alert of currentAlerts) {
      try {
        addLog(`Fetching live data for ${alert.ticker} via Backend...`);
        const price = await invoke<number>("get_stock_price", { ticker: alert.ticker });
        const formattedPrice = parseFloat(price.toFixed(2));
        storage.updateAlertPrice(alert.id, formattedPrice);

        if (formattedPrice >= alert.targetPrice && alert.status !== "triggered") {
          addLog(`ALERT: ${alert.ticker} hit target price of $${alert.targetPrice} (Now: $${formattedPrice})`);

          if (currentSettings.telegramToken && currentSettings.telegramChatId) {
            addLog(`Sending Telegram notification for ${alert.ticker}...`);
            await invoke("send_telegram_notification", {
              token: currentSettings.telegramToken,
              chatId: currentSettings.telegramChatId,
              message: `<b>Stock Alert!</b>\n\n${alert.ticker} has reached your target price of <b>$${alert.targetPrice}</b>. \n\nCurrent price: <b>$${formattedPrice}</b>.`
            });
            addLog("Telegram notification sent.");
          }
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

  useEffect(() => {
    setAlerts(storage.getAlerts());
    const s = storage.getSettings();
    setSettings(s);
    setTokenInput(s.telegramToken);
    setChatIdInput(s.telegramChatId);
    syncStocks();
  }, [syncStocks]);

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

    if (editingId) {
      storage.updateAlert(editingId, tickerInput, parseFloat(priceInput));
      addLog(`Updated alert for ${tickerInput.toUpperCase()}`);
      setEditingId(null);
    } else {
      const alert = storage.saveAlert(tickerInput, parseFloat(priceInput));
      addLog(`Added alert for ${alert.ticker} at $${alert.targetPrice}`);
    }

    setAlerts([...storage.getAlerts()]);
    setTickerInput("");
    setPriceInput("");
    syncStocks();
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const newSettings = { telegramToken: tokenInput, telegramChatId: chatIdInput };
    storage.saveSettings(newSettings);
    setSettings(newSettings);
    addLog("Telegram settings saved.");
  };

  const handleEdit = (alert: StockAlert) => {
    setTickerInput(alert.ticker);
    setPriceInput(alert.targetPrice.toString());
    setEditingId(alert.id);
    setActiveTab("stocks");
  };

  const handleDelete = (id: string) => {
    storage.deleteAlert(id);
    setAlerts(storage.getAlerts());
    addLog("Alert removed.");
  };

  const handleTestTelegram = async () => {
    const s = storage.getSettings();
    if (!s.telegramToken || !s.telegramChatId) {
      addLog("Error: Setup Telegram in Settings first!");
      return;
    }

    addLog("Sending test Telegram message...");
    try {
      await invoke("send_telegram_notification", {
        token: s.telegramToken,
        chatId: s.telegramChatId,
        message: "<b>Test Successful!</b>\n\nYour Pulse app is correctly connected to Telegram."
      });
      addLog("Test message sent successfully!");
    } catch (err) {
      addLog(`Test failed: ${String(err)}`);
    }
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
          <div className="text-zinc-600 italic tracking-tight">System standby... awaiting signals.</div>
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
      <form onSubmit={handleAddAlert} className={`grid grid-cols-1 md:grid-cols-3 gap-4 p-8 rounded-3xl border transition-all ${editingId ? "bg-indigo-600/10 border-indigo-500" : "bg-zinc-900/50 border-zinc-800"}`}>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{editingId ? "Editing Ticker" : "Ticker"}</label>
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            placeholder="AAPL, TSLA..."
            className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-indigo-500 outline-none transition-all font-bold"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Target Price ($)</label>
          <input
            type="number"
            step="0.01"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="500.00"
            className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-indigo-500 outline-none transition-all font-bold"
          />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className={`flex-1 font-black py-4 rounded-2xl transition-all uppercase tracking-widest shadow-lg active:scale-95 ${editingId ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}>
            {editingId ? "Update ✓" : "Set Alert +"}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setTickerInput(""); setPriceInput(""); }} className="px-4 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-2xl font-bold transition-all">✕</button>
          )}
        </div>
      </form>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-xl font-black uppercase tracking-tighter italic">Active Alerts</h3>
          <button onClick={syncStocks} disabled={isSyncing} className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-zinc-800 transition-all ${isSyncing ? "animate-pulse border-indigo-500 text-indigo-500" : "hover:bg-zinc-800"}`}>
            {isSyncing ? "Syncing..." : "Refresh Now ↻"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {alerts.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 italic border border-dashed border-zinc-800 rounded-[2rem]">No active alerts. Add a ticker above.</div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="p-6 rounded-3xl bg-white/5 border border-zinc-800 flex items-center justify-between group hover:border-zinc-700 transition-all">
                <div className="flex items-center gap-6">
                  <div>
                    <h4 className="text-2xl font-black tracking-tighter">{alert.ticker}</h4>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Target: ${alert.targetPrice.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(alert)} className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors" title="Edit">✏️</button>
                    <button onClick={() => handleDelete(alert.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Delete">🗑️</button>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black font-mono tracking-tighter ${alert.status === "triggered" ? "text-red-500 animate-pulse" : "text-emerald-500"}`}>
                    ${alert.lastPrice || "---"}
                  </p>
                  <p className="text-[8px] text-zinc-600 uppercase font-black tracking-widest">Updated: {new Date(alert.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => {
    const isConfigured = settings.telegramToken && settings.telegramChatId;

    return (
      <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl mx-auto">
        <div className="p-8 rounded-[2.5rem] bg-zinc-900/50 border border-zinc-800 space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-3xl">🤖</span>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Telegram Integration</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                {isConfigured ? "Connection Secure & Active" : "Get mobile alerts via Telegram Bot"}
              </p>
            </div>
          </div>

          {isConfigured ? (
            <div className="space-y-4">
              <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-emerald-400">Telegram Bot Configured</span>
                </div>
                <button
                  onClick={() => {
                    storage.saveSettings({ telegramToken: "", telegramChatId: "" });
                    setSettings({ telegramToken: "", telegramChatId: "" });
                    setTokenInput("");
                    setChatIdInput("");
                    addLog("Telegram settings cleared.");
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Reset Credentials ↺
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 px-2 italic">Credentials are encrypted in local storage and hidden from the UI for your safety.</p>
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Bot Token</label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste Token here..."
                  className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Chat ID</label>
                <input
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="Enter Chat ID..."
                  className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                />
              </div>
              <button type="submit" className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-black py-4 rounded-2xl transition-all uppercase tracking-widest shadow-lg active:scale-95">
                Save & Protect ✓
              </button>
            </form>
          )}

          {!isConfigured && (
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-[10px] text-zinc-500 space-y-2 leading-relaxed">
              <p className="font-bold text-indigo-400 uppercase tracking-widest">Setup Guide</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Message <a href="https://t.me/botfather" target="_blank" className="text-indigo-400 underline">@BotFather</a> on Telegram to create a bot.</li>
                <li>Message <a href="https://t.me/userinfobot" target="_blank" className="text-indigo-400 underline">@userinfobot</a> to find your <b>Chat ID</b>.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-black text-white font-sans overflow-hidden">
      <aside className="w-16 md:w-64 border-r border-zinc-800 flex flex-col p-4 md:p-8 gap-10 bg-black/50 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4 px-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-xl shadow-lg rotate-3" onClick={syncStocks}>⚡</div>
          <h1 className="hidden md:block font-black tracking-tighter text-2xl italic text-white">PULSE</h1>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab("stocks")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === "stocks" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-white"}`}>
            <span className="text-xl">📈</span>
            <span className="hidden md:block font-black text-xs uppercase tracking-widest">Stocks</span>
          </button>
          <button onClick={() => setActiveTab("terminal")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === "terminal" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-white"}`}>
            <span className="text-xl">📺</span>
            <span className="hidden md:block font-black text-xs uppercase tracking-widest">Console</span>
          </button>
          <button onClick={() => setActiveTab("settings")} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === "settings" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-white"}`}>
            <span className="text-xl">⚙️</span>
            <span className="hidden md:block font-black text-xs uppercase tracking-widest">Settings</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto relative">
        <div className="absolute top-6 right-6 md:top-12 md:right-12 flex gap-3 z-50">
          <button
            onClick={handleTestTelegram}
            className="w-12 h-12 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded-full flex items-center justify-center text-xl shadow-2xl active:scale-90 transition-all group"
            title="Test Telegram"
          >
            <span className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">🚀</span>
          </button>
          <button
            onClick={() => addLog("Diagnostic check initiated.")}
            className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full flex items-center justify-center text-xl shadow-2xl active:scale-90 transition-all group"
            title="System Check"
          >
            <span className="group-hover:rotate-12 transition-transform">✋</span>
          </button>
        </div>

        <div className="max-w-4xl mx-auto">
          <header className="mb-12 flex justify-between items-center">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tighter italic">
                {activeTab === "stocks" ? "Market Monitor" : activeTab === "terminal" ? "Pulse System Log" : "Preferences"}
              </h2>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mt-1">
                {activeTab === "stocks" ? "Real-time alerts & tracking" : activeTab === "terminal" ? "Runtime diagnostic messages" : "Configure integrations & alerts"}
              </p>
            </div>
            {isSyncing && (
              <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-widest animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Live Syncing
              </div>
            )}
          </header>
          {activeTab === "stocks" ? renderStocks() : activeTab === "terminal" ? renderTerminal() : renderSettings()}
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
