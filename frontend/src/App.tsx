import { useState, useEffect } from 'react'

declare global {
  interface Window {
    electronAPI?: {
      loginToVinted: () => void;
      onLoginSuccess: (callback: (success: boolean) => void) => void;
    };
  }
}

interface Task {
  id: string;
  keywords: string;
  maxPrice: number | null;
  status: boolean;
  webhookUrl?: string;
  autoBuy: boolean;
}

interface LogEntry {
  time: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [vintedConnected, setVintedConnected] = useState(false);
  
  // États du formulaire
  const [newKeywords, setNewKeywords] = useState('');
  const [newMaxPrice, setNewMaxPrice] = useState('');
  const [newWebhook, setNewWebhook] = useState('');
  const [newAutoBuy, setNewAutoBuy] = useState(false);

  const fetchTasks = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/tasks`);
      if (!resp.ok) throw new Error('API Error');
      const data = await resp.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (_e) {
      setTasks([]);
    }
  };

  // Connexion SSE pour les logs avec gestion de reconnexion
  useEffect(() => {
    let eventSource: EventSource;
    let timeoutId: number;

    const connectSSE = () => {
      eventSource = new EventSource(`${API_URL}/api/logs`);
      
      eventSource.onmessage = (event) => {
        try {
          const log = JSON.parse(event.data);
          setLogs(prev => [log, ...prev].slice(0, 50));
        } catch (_e) {
          console.error("Failed to parse log", _e);
        }
      };

      eventSource.onerror = () => {
        console.warn("SSE connection lost. Retrying in 3s...");
        eventSource.close();
        timeoutId = window.setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onLoginSuccess((success) => {
        if (success) setVintedConnected(true);
      });
    }
  }, []);

  useEffect(() => { fetchTasks(); }, []);

  const handleLogin = () => {
    if (window.electronAPI) {
      window.electronAPI.loginToVinted();
    } else {
      alert("La connexion Vinted est réservée à l'application Desktop.");
    }
  };

  const createTask = async () => {
    if (!newKeywords) return;
    try {
      const resp = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keywords: newKeywords, 
          maxPrice: parseFloat(newMaxPrice) || null,
          webhookUrl: newWebhook,
          autoBuy: newAutoBuy,
          status: true
        })
      });
      if (resp.ok) {
        setShowModal(false);
        setNewKeywords('');
        setNewMaxPrice('');
        setNewWebhook('');
        setNewAutoBuy(false);
        fetchTasks();
      }
    } catch (_e) { console.error(_e); }
  };

  const toggleTask = async (task: Task) => {
    try {
      const newStatus = !task.status;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

      const resp = await fetch(`${API_URL}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!resp.ok) fetchTasks();
    } catch (_e) { 
      console.error(_e);
      fetchTasks();
    }
  };

  const deleteTask = async (id: string) => {
    if (confirm('Supprimer cette tâche ?')) {
      await fetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    }
  };

  return (
    <div className="min-h-screen bg-vinted-dark text-slate-200 p-4 md:p-8 font-sans selection:bg-vinted-accent/30 overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-vinted-glow/20 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-vinted-accent/10 blur-[150px] rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16 relative">
        <div className="animate-in fade-in slide-in-from-left duration-1000">
          <div className="flex items-center gap-4">
            <div className="relative">
              <h1 className="text-5xl font-black tracking-tighter text-white uppercase flex items-center gap-2 drop-shadow-2xl">
                Sniper <span className="text-vinted-glow italic">V1</span><span className="animate-pulse text-vinted-glow">_</span>
              </h1>
              <div className="absolute -top-1 -right-4 flex gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-vinted-glow shadow-[0_0_8px_#00adb5]"></div>
              </div>
            </div>
          </div>
          <p className="text-slate-500 text-[10px] mt-2 uppercase tracking-[0.4em] font-black opacity-80">Neural Monitoring & Automated Acquisitions</p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={handleLogin}
            className={`group relative px-6 py-4 rounded-2xl font-black uppercase tracking-[0.15em] overflow-hidden transition-all hover:scale-[1.02] active:scale-95 shadow-2xl border ${
              vintedConnected 
              ? 'bg-green-500/10 border-green-500/30 text-green-500' 
              : 'bg-slate-900/40 border-white/5 text-white/70 hover:border-white/20'
            }`}
          >
            <span className="relative z-10 flex items-center gap-3 text-sm">
               <div className={`w-2 h-2 rounded-full ${vintedConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
               {vintedConnected ? 'Account Linked' : 'Connect Vinted'}
            </span>
          </button>

          <button 
            onClick={() => setShowModal(true)}
            className="group relative px-10 py-4 rounded-2xl bg-vinted-accent text-white font-black uppercase tracking-[0.15em] overflow-hidden transition-all hover:scale-[1.02] active:scale-95 shadow-[0_20px_40px_-15px_rgba(255,68,102,0.3)]"
          >
            <span className="relative z-10 flex items-center gap-3 text-sm">
               <svg className="w-5 h-5 stroke-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Initialize Protocol
            </span>
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 flex flex-col gap-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Active Snipers', val: tasks.filter(t => t.status).length.toString().padStart(2, '0'), color: 'bg-blue-500', glow: 'shadow-blue-500/20' },
              { label: 'Items Scanned', val: '42', color: 'bg-green-500', glow: 'shadow-green-500/20' },
              { label: 'System Health', val: '100%', color: 'bg-vinted-glow', glow: 'shadow-vinted-glow/20' }
            ].map((s, i) => (
              <div key={i} className={`group bg-slate-900/60 border border-white/5 p-8 rounded-4xl backdrop-blur-3xl transition-all hover:border-white/10 ${s.glow} hover:shadow-2xl`}>
                <h3 className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.color} animate-pulse`}></div> {s.label}
                </h3>
                <p className="text-6xl font-black text-white tracking-tighter group-hover:scale-105 transition-transform duration-500">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="flex-1 bg-slate-900/40 border border-white/5 rounded-[2.5rem] backdrop-blur-3xl flex flex-col overflow-hidden min-h-[450px] shadow-2xl relative">
            <div className="absolute inset-0 bg-linear-to-b from-white/2 to-transparent pointer-events-none"></div>
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/2">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/20"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 border border-yellow-500/20"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/40 border border-green-500/20"></div>
                </div>
                <h3 className="text-white/70 font-black uppercase text-[10px] tracking-[0.3em] ml-2">Live Intel_Stream</h3>
              </div>
              <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></div>
                <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Live</span>
              </div>
            </div>
            
            <div className="flex-1 p-8 font-mono text-[13px] overflow-y-auto space-y-3 max-h-[500px] scrollbar-hide">
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 animate-pulse">
                  <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span className="uppercase tracking-[0.2em] font-bold text-[10px]">Establishing secure connection...</span>
                </div>
              )}
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-5 animate-in slide-in-from-bottom-2 duration-500 ${i === 0 ? 'text-white border-l-2 border-vinted-glow pl-4 bg-vinted-glow/5 py-1' : 'text-slate-500 pl-4'}`}>
                  <span className="opacity-40 tabular-nums">[{log.time}]</span>
                  <span className={`font-medium ${
                    log.type === 'success' ? 'text-green-400' : 
                    log.type === 'warning' ? 'text-yellow-400' : 
                    log.type === 'error' ? 'text-red-400' : ''
                  }`}>
                    {log.msg.startsWith('✨') ? <span className="mr-2">⚡</span> : null}
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="flex justify-between items-end px-2">
            <div>
              <h3 className="text-white font-black uppercase text-xs tracking-[0.25em]">Targeting Protocol</h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Sectors currently monitored</p>
            </div>
            <span className="bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 tabular-nums">
              {tasks.length.toString().padStart(2, '0')} UNITS
            </span>
          </div>
          
          <div className="space-y-5">
            {tasks.length === 0 && (
              <div className="p-10 border-2 border-dashed border-white/5 rounded-[2.5rem] text-center opacity-40 group cursor-pointer hover:bg-white/2 transition-colors" onClick={() => setShowModal(true)}>
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest">No active modules</p>
              </div>
            )}
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className={`group relative transition-all duration-700 rounded-4xl p-8 backdrop-blur-3xl border ${
                  task.status 
                    ? 'bg-slate-900/60 border-white/10 hover:border-vinted-glow/30 shadow-2xl shadow-vinted-glow/5' 
                    : 'bg-black/20 border-white/3 opacity-40 grayscale'
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <h4 className="text-2xl font-black text-white group-hover:text-vinted-glow transition-colors uppercase tracking-tighter leading-none">
                      {task.keywords}
                    </h4>
                    <div className="flex items-center gap-2 pt-2">
                      <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                        <span className="text-[10px] font-black text-slate-400 tabular-nums uppercase tracking-tighter">
                          {task.maxPrice ? `${task.maxPrice}€ MAX` : '∞ BUDGET'}
                        </span>
                      </div>
                      {task.autoBuy && (
                        <div className="flex items-center gap-1.5 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20">
                          <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></div>
                          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Sniper</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => toggleTask(task)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-xl ${
                        task.status 
                          ? 'bg-vinted-glow/20 text-vinted-glow border border-vinted-glow/30 hover:bg-vinted-glow hover:text-white' 
                          : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <svg className="w-6 h-6 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={task.status ? "M10 9v6m4-6v6" : "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"} />
                      </svg>
                    </button>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="w-12 h-12 rounded-2xl bg-red-500/5 text-red-500/40 border border-red-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                
                {task.status && (
                  <div className="pt-4 border-t border-white/3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                       </span>
                      <span className="text-[9px] font-black text-green-500 uppercase tracking-[0.2em] opacity-80">Scanning Frequencies...</span>
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 opacity-40">#{task.id.slice(0, 8)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setShowModal(false)}></div>
          <div className="relative w-full max-w-xl bg-vinted-dark border border-white/10 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden p-12 animate-in zoom-in-95 duration-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-vinted-glow to-transparent"></div>
            
            <header className="mb-10 text-center">
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Initialize Protocol_</h2>
              <div className="h-px w-20 bg-vinted-glow/30 mx-auto mt-4"></div>
            </header>
            
            <div className="space-y-8">
              <div className="group">
                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3 px-2 transition-colors group-focus-within:text-vinted-glow">Cortex Keywords</label>
                <input 
                  type="text" 
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  placeholder="ex: switch nintendo oled"
                  className="w-full bg-white/3 border border-white/5 rounded-2xl px-8 py-5 text-white placeholder:text-white/10 focus:outline-none focus:border-vinted-glow focus:bg-white/5 transition-all text-lg font-bold"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3 px-2">Budget Threshold</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={newMaxPrice}
                      onChange={(e) => setNewMaxPrice(e.target.value)}
                      placeholder="∞"
                      className="w-full bg-white/3 border border-white/5 rounded-2xl px-8 py-5 text-white placeholder:text-white/10 focus:outline-none focus:border-vinted-glow focus:bg-white/5 transition-all text-lg font-bold tabular-nums"
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-white/20 text-xl tracking-tighter">€</span>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3 px-2">Sniper Induction</label>
                  <button 
                    onClick={() => setNewAutoBuy(!newAutoBuy)}
                    className={`w-full overflow-hidden relative rounded-2xl py-5 font-black uppercase text-[11px] tracking-widest transition-all border duration-500 h-[68px] ${
                      newAutoBuy 
                        ? 'bg-red-500/10 border-red-500/50 text-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]' 
                        : 'bg-white/3 border-white/5 text-slate-600'
                    }`}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {newAutoBuy ? 'Combat Mode Active 🏹' : 'Standard Watch'}
                    </span>
                    {newAutoBuy && <div className="absolute inset-0 bg-red-500/5 animate-pulse"></div>}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3 px-2">Transmission Link (Webhook)</label>
                <input 
                  type="text" 
                  value={newWebhook}
                  onChange={(e) => setNewWebhook(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-white/3 border border-white/5 rounded-2xl px-8 py-4 text-white/50 placeholder:text-white/5 focus:outline-none focus:border-vinted-glow transition-all text-xs font-mono"
                />
              </div>

              <div className="flex gap-6 pt-6">
                <button 
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-8 py-5 rounded-2xl bg-white/5 text-slate-500 font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all text-xs"
                >
                  Terminate
                </button>
                <button 
                  onClick={createTask}
                  className="flex-[1.5] px-8 py-5 rounded-2xl bg-vinted-accent text-white font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(255,68,102,0.4)] hover:brightness-110 active:scale-95 transition-all text-xs"
                >
                  Deploy Module
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
