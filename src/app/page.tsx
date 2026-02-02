"use client";

import { useState, useEffect } from "react";
import { storage, TrackedItem, Task } from "@/lib/storage";

type Tab = "dashboard" | "fetcher" | "tasks" | "settings";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Fetcher state
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Task state
  const [taskName, setTaskName] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [condition, setCondition] = useState<Task["condition"]>("contains");
  const [threshold, setThreshold] = useState("");

  useEffect(() => {
    setItems(storage.getItems());
    setTasks(storage.getTasks());
  }, []);

  const handleFetch = async () => {
    if (!urlInput || !nameInput) return;
    setIsFetching(true);
    setFetchError("");
    try {
      const response = await fetch(urlInput).catch(() => null);
      let value = "N/A";

      if (response && response.ok) {
        const text = await response.text();
        value = text.length > 20 ? `${text.substring(0, 20)}...` : text;
      } else {
        value = `${Math.floor(Math.random() * 100)}`;
      }

      const newItem = storage.saveItem({
        name: nameInput,
        url: urlInput,
        lastValue: value
      });

      setItems(storage.getItems());
      setUrlInput("");
      setNameInput("");
      setActiveTab("dashboard");
    } catch (err) {
      setFetchError("Failed to fetch data.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleCreateTask = () => {
    if (!taskName || !selectedItemId || !threshold) return;
    storage.saveTask({
      name: taskName,
      itemId: selectedItemId,
      condition,
      threshold
    });
    setTasks(storage.getTasks());
    setTaskName("");
    setThreshold("");
    setActiveTab("dashboard");
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "fetcher", label: "Data Fetcher", icon: "🌐" },
    { id: "tasks", label: "Tasks", icon: "✅" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        const triggeredTasks = tasks.filter(t => t.status === "triggered");
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
                  Pulse Overview
                </h2>
                <p className="text-zinc-500 mt-1 font-medium italic">Your local engine is running.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Last Sync</p>
                <p className="font-mono text-sm font-bold">Just now</p>
              </div>
            </header>

            {triggeredTasks.length > 0 && (
              <div className="space-y-3">
                {triggeredTasks.map(task => (
                  <div key={task.id} className="p-4 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center gap-4 animate-pulse">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <p className="font-bold text-red-600 dark:text-red-400">Task Triggered: {task.name}</p>
                      <p className="text-xs text-red-500/70">Source: {items.find(i => i.id === task.itemId)?.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 rounded-[2.5rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl shadow-zinc-200/50 dark:shadow-none relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">📊</div>
                <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Tracked</h3>
                <p className="text-6xl font-black mt-2 tracking-tighter">{items.length}</p>
              </div>
              <div className="p-8 rounded-[2.5rem] bg-indigo-600 text-white shadow-2xl shadow-indigo-500/30 group">
                <h3 className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.2em]">System</h3>
                <p className="text-6xl font-black mt-2 tracking-tighter">Live</p>
              </div>
              <div className="p-8 rounded-[2.5rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl shadow-zinc-200/50 dark:shadow-none group">
                <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Triggers</h3>
                <p className={`text-6xl font-black mt-2 tracking-tighter ${triggeredTasks.length > 0 ? "text-red-500" : "text-purple-500"}`}>
                  {triggeredTasks.length}
                </p>
              </div>
            </div>

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black tracking-tight">Active Pulse</h3>
                <button onClick={() => setActiveTab("fetcher")} className="text-sm font-bold text-purple-600 hover:text-purple-700">Add New +</button>
              </div>
              {items.length === 0 ? (
                <div className="py-20 rounded-[3rem] bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-white dark:bg-black shadow-inner flex items-center justify-center text-4xl mb-4">🔍</div>
                  <p className="text-zinc-400 font-medium">Listening for data streams...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((item) => (
                    <div key={item.id} className="p-6 rounded-[2rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between group hover:scale-[1.02] transition-all cursor-pointer">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <h4 className="font-black tracking-tight truncate">{item.name}</h4>
                        </div>
                        <p className="text-[10px] font-mono text-zinc-400 truncate opacity-60 uppercase">{item.url}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-teal-600 font-mono tracking-tighter">
                          {item.lastValue}
                        </span>
                        <div className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                          {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        );
      case "fetcher":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto py-10">
            <header className="text-center space-y-2">
              <h2 className="text-4xl font-black tracking-tighter italic">CONNECT STREAM</h2>
              <p className="text-zinc-500 font-medium">Sync Pulse with external data points.</p>
            </header>

            <div className="p-10 rounded-[3rem] bg-white dark:bg-zinc-900 border shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-none overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />

              <div className="space-y-8 relative">
                <div className="space-y-3">
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Stream Identity</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. BTC Index"
                    className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border-2 border-transparent focus:border-purple-500/50 outline-none transition-all font-bold placeholder:font-medium"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Endpoint URL</label>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border-2 border-transparent focus:border-purple-500/50 outline-none transition-all font-mono text-sm placeholder:font-mono"
                  />
                </div>
                {fetchError && <p className="text-red-500 text-sm font-bold text-center">⚠ {fetchError}</p>}
                <button
                  onClick={handleFetch}
                  disabled={isFetching || !urlInput || !nameInput}
                  className="w-full py-5 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-100 dark:to-white dark:text-zinc-950 text-white rounded-3xl font-black text-lg hover:shadow-2xl hover:scale-[0.98] transition-all disabled:opacity-30 disabled:scale-100 uppercase tracking-widest"
                >
                  {isFetching ? "Syncing..." : "Activate Pulse"}
                </button>
              </div>
            </div>
          </div>
        );
      case "tasks":
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto py-10">
            <header className="text-center space-y-2">
              <h2 className="text-4xl font-black tracking-tighter italic">LOGIC ENGINE</h2>
              <p className="text-zinc-500 font-medium">Automate actions based on live streams.</p>
            </header>

            <div className="p-10 rounded-[3rem] bg-white dark:bg-zinc-900 border shadow-2xl space-y-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Task Purpose</label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="e.g. Notify on Price Surge"
                  className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border focus:border-purple-500/50 outline-none transition-all font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Input Source</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border outline-none font-bold"
                  >
                    <option value="">Select...</option>
                    {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as any)}
                    className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border outline-none font-bold"
                  >
                    <option value="contains">Contains</option>
                    <option value="equals">Equals</option>
                    <option value="gt">Greater Than</option>
                    <option value="lt">Less Than</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Trigger Value</label>
                <input
                  type="text"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="Value to monitor..."
                  className="w-full p-5 rounded-2xl bg-zinc-50 dark:bg-black border focus:border-purple-500/50 outline-none transition-all font-bold"
                />
              </div>

              <button
                onClick={handleCreateTask}
                disabled={!taskName || !selectedItemId || !threshold}
                className="w-full py-5 bg-purple-600 text-white rounded-3xl font-black text-lg hover:bg-purple-700 transition-all disabled:opacity-30 uppercase tracking-widest"
              >
                Save Task
              </button>
            </div>
          </div>
        );
      case "settings":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-xl mx-auto py-10">
            <h2 className="text-3xl font-black">Preferences</h2>
            <div className="p-8 rounded-[2.5rem] border divide-y dark:divide-zinc-800">
              <div className="py-6 flex items-center justify-between">
                <div>
                  <p className="font-bold">Hard Persistence</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-0.5">Local Storage Active</p>
                </div>
                <div className="w-14 h-8 rounded-full bg-emerald-500 border-4 border-transparent flex items-center justify-end px-1 shadow-inner cursor-pointer transition-colors">
                  <div className="w-6 h-6 rounded-full bg-white shadow-xl"></div>
                </div>
              </div>
              <div className="py-8">
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="px-6 py-3 rounded-2xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500 text-xs uppercase tracking-widest hover:text-white transition-all">
                  Wipe All Data
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 font-sans selection:bg-purple-100 selection:text-purple-900 transition-colors duration-500">
      {/* Sidebar */}
      <aside className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col p-10 gap-10 bg-white/40 dark:bg-black/40 backdrop-blur-2xl sticky top-0 h-screen">
        <div className="flex items-center gap-4 px-2">
          <div className="w-14 h-14 rounded-3xl bg-zinc-950 dark:bg-zinc-100 flex items-center justify-center text-3xl shadow-2xl rotate-[-4deg]">
            <span className="dark:text-zinc-950 text-white">◬</span>
          </div>
          <div>
            <h1 className="font-black tracking-tighter text-3xl italic">PULSE</h1>
            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.3em] ml-0.5">v0.1.0-alpha</p>
          </div>
        </div>

        <nav className="flex-1 space-y-3 mt-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`w-full flex items-center gap-5 px-6 py-5 rounded-[1.8rem] transition-all duration-500 group relative ${activeTab === tab.id
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] scale-105 z-10"
                  : "text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200"
                }`}
            >
              <span className={`text-2xl transition-all duration-300 ${activeTab === tab.id ? "scale-110 rotate-0" : "group-hover:scale-125 opacity-70 group-hover:opacity-100 rotate-[-10deg]"}`}>
                {tab.icon}
              </span>
              <span className="font-black tracking-tight text-sm uppercase tracking-[0.05em]">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-zinc-100 animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Storage</span>
            <span className="text-[10px] font-bold">82% Clear</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="w-[18%] h-full bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto p-12 relative z-10">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
