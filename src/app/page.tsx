"use client";

import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);

  const handleClick = () => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setMessages((prev) => [...prev, `[${time}] app is ready`]);
  };

  return (
    <div className="flex min-h-screen bg-black text-white font-mono p-12 relative overflow-hidden">
      {/* Floating Button in Top Right */}
      <button
        onClick={handleClick}
        className="fixed top-6 right-6 w-12 h-12 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full flex items-center justify-center text-xl shadow-2xl active:scale-90 transition-all z-50 group"
        title="Trigger Terminal"
      >
        <span className="group-hover:rotate-12 transition-transform">✋</span>
      </button>

      {/* Main Terminal Box */}
      <main className="max-w-4xl w-full mx-auto flex flex-col h-[70vh] self-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-t-xl p-3 flex gap-2 items-center">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/50" />
          <span className="ml-2 text-xs text-zinc-500 font-bold uppercase tracking-widest">Pulse Terminal</span>
        </div>

        <div className="flex-1 bg-zinc-950/50 backdrop-blur-md border-x border-b border-zinc-800 rounded-b-xl p-6 overflow-y-auto space-y-2 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="flex items-center gap-2 text-zinc-600 italic">
              <span className="animate-pulse">_</span>
              <span>Waiting for initialization...</span>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-zinc-600 select-none">➜</span>
                <span className="text-emerald-500">{msg}</span>
              </div>
            ))
          )}
          {messages.length > 0 && (
            <div className="flex items-center gap-2 text-emerald-500">
              <span className="animate-pulse">_</span>
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}
