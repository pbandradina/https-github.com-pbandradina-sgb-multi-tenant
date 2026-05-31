import React, { useState, useEffect } from "react";
import { 
  Flame, Shield, Clock, Users, Calendar, Truck, 
  MessageSquare, AlertTriangle, Menu, X, Database, FileSpreadsheet, Award,
  Lock, Unlock, LogOut, PlusCircle, ShieldCheck
} from "lucide-react";
import { Quartel, Bombeiro, Escala, Viatura, Ocorrencia, MuralPost, Afastamento, Fmo } from "./types";
import Dashboard from "./components/Dashboard";
import EscalasManager from "./components/EscalasManager";
import EfetivoManager from "./components/EfetivoManager";
import FrequenciaManager from "./components/FrequenciaManager";
import FmosDashboard from "./components/FmosDashboard";

export default function App() {
  // Mobile navigation
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [activeAdmin, setActiveAdmin] = useState<{ username: string; nome: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("adminSession20gb");
    if (saved) {
      try {
        setActiveAdmin(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar sessão:", e);
        localStorage.removeItem("adminSession20gb");
      }
    }
  }, []);

  // Modals for Authentication
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  const [regUser, setRegUser] = useState("");
  const [regNome, setRegNome] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  // Tab Manager
  const [activeTab, setActiveTab] = useState<"dashboard" | "escalas" | "efetivo" | "frequencia" | "fmos_dashboard">("dashboard");

  // Multi-tenant Active Fire Station
  const [selectedQuartelId, setSelectedQuartelId] = useState("q1");

  // Database Connection Status Information
  const [dbStatus, setDbStatus] = useState({
    connected: false,
    database: "PostgreSQL",
    connectionString: "Buscando..."
  });

  // Application State
  const [quarteis, setQuarteis] = useState<Quartel[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [viaturas, setViaturas] = useState<Viatura[]>([]);
  const [mural, setMural] = useState<MuralPost[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [afastamentos, setAfastamentos] = useState<Afastamento[]>([]);
  const [fmos, setFmos] = useState<Fmo[]>([]);
  
  // SGB System Clock
  const [currentTime, setCurrentTime] = useState("");

  // Error Alert Status
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Live Sync Poller interval setup to simulate real-time scales
  useEffect(() => {
    // 1. Fetch system clock
    const clockTimer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleString("pt-BR", { 
        timeZone: "America/Sao_Paulo", 
        hour: "2-digit", 
        minute: "2-digit", 
        second: "2-digit"
       }) + " BRT");
    }, 1000);

    return () => clearInterval(clockTimer);
  }, []);

  // Fetch initial setup and continuous polling to provide REAL-TIME sync
  const fetchAllData = async () => {
    try {
      const [resStatus, resQuarteis, resBombeiros, resEscalas, resViaturas, resOcorrencias, resMural, resAfastamentos, resFmos] = await Promise.all([
        fetch("/api/status").then(r => r.json()),
        fetch("/api/quarteis").then(r => r.json()),
        fetch("/api/bombeiros").then(r => r.json()),
        fetch("/api/escalas").then(r => r.json()),
        fetch("/api/viaturas").then(r => r.json()),
        fetch("/api/ocorrencias").then(r => r.json()),
        fetch("/api/mural").then(r => r.json()),
        fetch("/api/afastamentos").then(r => r.json()),
        fetch("/api/fmos").then(r => r.json())
      ]);

      setDbStatus(resStatus);
      setQuarteis(resQuarteis);
      setBombeiros(resBombeiros);
      setEscalas(resEscalas);
      setViaturas(resViaturas);
      setOcorrencias(resOcorrencias);
      setMural(resMural);
      setAfastamentos(resAfastamentos);
      setFmos(resFmos);
      
      // Clear errors
      setErrorBanner(null);
    } catch (err) {
      console.error("Erro ao sincronizar dados do servidor:", err);
      setErrorBanner("Falha na sincronização operacional em tempo real. Reconectando...");
    }
  };

  useEffect(() => {
    // Immediate fetch
    fetchAllData();

    // SGB Continuous Poller: Fetch every 3 seconds!
    const syncTimer = setInterval(() => {
      fetchAllData();
    }, 3000);

    return () => clearInterval(syncTimer);
  }, []);

  // API operations callbacks
  const handleCreateMural = async (title: string, content: string, re: string) => {
    try {
      const response = await fetch("/api/mural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, authorRe: re, quartelId: selectedQuartelId })
      });
      if (response.ok) {
        const newPost = await response.json();
        setMural(prev => [newPost, ...prev]);
      }
    } catch (e) {
      console.error(e);
      setErrorBanner("Erro ao fixar aviso operacional.");
    }
  };

  const handleDeleteMural = async (id: string) => {
    try {
      const response = await fetch(`/api/mural/${id}`, { method: "DELETE" });
      if (response.ok) {
        setMural(prev => prev.filter(m => m.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateViaturaStatus = async (id: string, status: string, escala_atual: string) => {
    try {
      const response = await fetch(`/api/viaturas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, escala_atual })
      });
      if (response.ok) {
        const updated = await response.json();
        setViaturas(prev => prev.map(v => v.id === id ? updated : v));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddQuickOccurrence = async (tipo: string, endereco: string, viaturaId: string) => {
    try {
      // Automatic fleet deployment if viatura is selected
      let assignedVtrId = viaturaId || null;

      const response = await fetch("/api/ocorrencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quartel_id: selectedQuartelId,
          tipo,
          endereco,
          viatura_id: assignedVtrId,
          status: "Ativa",
          historico: `Viatura despachada em emergência imediata às ${new Date().toLocaleTimeString("pt-BR")}.`
        })
      });

      if (response.ok) {
        const newOco = await response.json();
        setOcorrencias(prev => [newOco, ...prev]);

        // If a vehicle was deployed, automatically set its state to 'Em Ocorrência' in our DB!
        if (assignedVtrId) {
          const vtr = viaturas.find(v => v.id === assignedVtrId);
          if (vtr) {
            await handleUpdateViaturaStatus(assignedVtrId, "Em Ocorrência", vtr.escala_atual);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setErrorBanner("Erro ao realizar o despacho emergencial.");
    }
  };

  const handleFecharOcorrencia = async (id: string, historico: string) => {
    try {
      const response = await fetch(`/api/ocorrencias/${id}/fechar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historico })
      });

      if (response.ok) {
        const closedOco = await response.json();
        setOcorrencias(prev => prev.map(o => o.id === id ? closedOco : o));

        // If the occurrence has a vehicle assigned, free up the vehicle dynamically to 'Pronta para Serviço'!
        if (closedOco.viatura_id) {
          const vtr = viaturas.find(v => v.id === closedOco.viatura_id);
          if (vtr) {
            await handleUpdateViaturaStatus(closedOco.viatura_id, "Pronta para Serviço", vtr.escala_atual);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setErrorBanner("Erro ao concluir ocorrência operante.");
    }
  };

  const handleAddBombeiro = async (data: Omit<Bombeiro, "id">) => {
    try {
      const response = await fetch("/api/bombeiros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        const newBombeiro = await response.json();
        setBombeiros(prev => {
          const exists = prev.some(b => b.id === newBombeiro.id);
          if (exists) {
            return prev.map(b => b.id === newBombeiro.id ? newBombeiro : b);
          }
          return [...prev, newBombeiro];
        });
      }
    } catch (e) {
      console.error(e);
      setErrorBanner("Erro ao registrar bombeiro militar.");
    }
  };

  const handleDeleteBombeiro = async (id: string) => {
    if (!confirm("Deseja realmente remover este bombeiro do quadro geral?")) return;
    try {
      const response = await fetch(`/api/bombeiros/${id}`, { method: "DELETE" });
      if (response.ok) {
        setBombeiros(prev => prev.filter(b => b.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddEscala = async (data: Omit<Escala, "id">) => {
    try {
      // 1. Register scale shift duty in DB
      const response = await fetch("/api/escalas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const newEscala = await response.json();
        setEscalas(prev => [...prev, newEscala]);

        // 2. Intelligent Auto-Tripulação of Viaturas!
        // If they chose a role connected to a vehicle (e.g. "Motorista ABS", "Socorrista UR", "Membro ABS"),
        // let's automatically attach them to that vehicle's live crew list!
        let targetVtrCode = "";
        if (data.funcao.includes("(ABS")) targetVtrCode = "ABS-201";
        if (data.funcao.includes("(UR")) targetVtrCode = "UR-205";
        if (data.funcao.includes("(AEM")) targetVtrCode = "AEM-202";

        if (targetVtrCode) {
          const targetVtr = viaturas.find(v => v.codigo === targetVtrCode && v.quartel_id === selectedQuartelId);
          if (targetVtr) {
            const currentStaff = targetVtr.escala_atual ? targetVtr.escala_atual.split(",").filter(Boolean) : [];
            if (!currentStaff.includes(data.bombeiro_id)) {
              currentStaff.push(data.bombeiro_id);
              await handleUpdateViaturaStatus(targetVtr.id, targetVtr.status, currentStaff.join(","));
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      setErrorBanner("Erro ao lançar escala laboral.");
    }
  };

  const handleDeleteEscala = async (id: string) => {
    try {
      const escalaNode = escalas.find(e => e.id === id);
      const response = await fetch(`/api/escalas/${id}`, { method: "DELETE" });
      if (response.ok) {
        setEscalas(prev => prev.filter(e => e.id !== id));

        // Let's untrip the firefighter from vehicles crew automatically!
        if (escalaNode) {
          const vtrsToScrub = viaturas.filter(v => v.quartel_id === selectedQuartelId);
          for (const vt of vtrsToScrub) {
            let crewArr = vt.escala_atual ? vt.escala_atual.split(",").filter(Boolean) : [];
            if (crewArr.includes(escalaNode.bombeiro_id)) {
              crewArr = crewArr.filter(cid => cid !== escalaNode.bombeiro_id);
              await handleUpdateViaturaStatus(vt.id, vt.status, crewArr.join(","));
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddAfastamento = async (data: Omit<Afastamento, "id">) => {
    try {
      const response = await fetch("/api/afastamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        const newAf = await response.json();
        setAfastamentos(prev => [...prev.filter(a => a.id !== newAf.id), newAf]);
      }
    } catch (e) {
      console.error(e);
      setErrorBanner("Erro ao registrar afastamento do militar.");
    }
  };

  const handleDeleteAfastamento = async (id: string) => {
    if (!confirm("Deseja realmente remover este afastamento?")) return;
    try {
      const response = await fetch(`/api/afastamentos/${id}`, { method: "DELETE" });
      if (response.ok) {
        setAfastamentos(prev => prev.filter(a => a.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSilentDeleteAfastamento = async (id: string) => {
    try {
      const response = await fetch(`/api/afastamentos/${id}`, { method: "DELETE" });
      if (response.ok) {
        setAfastamentos(prev => prev.filter(a => a.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFmo = async (data: Omit<Fmo, "id">) => {
    try {
      const response = await fetch("/api/fmos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        const newFmo = await response.json();
        setFmos(prev => [...prev.filter(f => f.id !== newFmo.id), newFmo]);
      }
    } catch (e) {
      console.error(e);
      setErrorBanner("Erro ao registrar Folga Mensal Obrigatória (FMO).");
    }
  };

  const handleDeleteFmo = async (id: string) => {
    if (!confirm("Deseja realmente remover esta folga obrigatória (FMO)?")) return;
    try {
      const response = await fetch(`/api/fmos/${id}`, { method: "DELETE" });
      if (response.ok) {
        setFmos(prev => prev.filter(f => f.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admins/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem("adminSession20gb", JSON.stringify(data.admin));
        setActiveAdmin(data.admin);
        setLoginModalOpen(false);
        setLoginUser("");
        setLoginPass("");
      } else {
        setLoginError(data.error || "Credenciais de administrador incorretas.");
      }
    } catch (err) {
      setLoginError("Erro ao conectar com o servidor.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");
    try {
      const res = await fetch("/api/admins/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUser, nome: regNome, password: regPass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRegSuccess(`Administrador "${regUser}" cadastrado com sucesso!`);
        setRegUser("");
        setRegNome("");
        setRegPass("");
      } else {
        setRegError(data.error || "Erro ao registrar administrador.");
      }
    } catch (err) {
      setRegError("Erro ao conectar com o servidor.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminSession20gb");
    setActiveAdmin(null);
  };

  const activeQuartelObj = quarteis.find(q => q.id === selectedQuartelId);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#e0e0e0] flex flex-col font-sans">
      
      {/* Red Alert Banner on Synchronizer Failure */}
      {errorBanner && (
        <div className="bg-red-650 bg-red-600 text-white font-bold py-2.5 px-4 text-center text-xs flex items-center justify-center gap-2 animate-pulse w-full no-print z-50">
          <AlertTriangle className="w-4 h-4" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Primary Top Header Navigation */}
      <header className="bg-[#111113] border-b border-white/5 text-[#e0e0e0] shadow-md sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Branding Shield Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-red-650 bg-red-600 p-2.5 rounded-xl glow-red">
                <Flame className="w-6 h-6 text-white stroke-[2.5]" />
              </div>
              <div>
                <div className="font-extrabold text-sm tracking-tight leading-none uppercase">20º GB • Escala SGB</div>
                <div className="text-[9px] text-slate-400 font-mono tracking-wider mt-0.5">PMESP • ESTADO DE SP</div>
              </div>
            </div>

            {/* Middle Nav Links */}
            <nav className="hidden xl:flex items-center space-x-1.5 animate-fade-in">
              {[
                { id: "dashboard", label: "Painel Operacional", icon: MessageSquare },
                { id: "escalas", label: "Escalas de Serviço", icon: Calendar },
                { id: "fmos_dashboard", label: "Folgas Obrigatórias (FMO)", icon: Award },
                { id: "efetivo", label: "Efetivo Militar", icon: Users },
                { id: "frequencia", label: "Controle de Frequência", icon: FileSpreadsheet }
              ].map((tab) => {
                const IconComp = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs tracking-tight transition cursor-pointer ${isSelected ? "bg-red-600 text-white" : "text-slate-350 hover:bg-slate-800 hover:text-white"}`}
                  >
                    <IconComp className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Right tenant and Clock hud elements */}
            <div className="hidden lg:flex items-center gap-3">
              
              {/* Dynamic Station Selector (Multi-Tenant Grouped by SGB) */}
              <div className="flex items-center gap-2 bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-700">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">POSTO:</label>
                <select 
                  className="bg-transparent text-xs font-extrabold text-white focus:outline-none cursor-pointer text-left w-[180px] pr-2"
                  value={selectedQuartelId}
                  onChange={(e) => setSelectedQuartelId(e.target.value)}
                >
                  <optgroup label="1º Subgrupamento (1º SGB)" className="bg-slate-900 text-red-400 font-extrabold">
                    {quarteis.filter(q => q.subgrupamento === "1º SGB").map(q => (
                      <option key={q.id} value={q.id} className="bg-slate-800 text-white font-bold">
                        {q.nome}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="2º Subgrupamento (2º SGB)" className="bg-slate-900 text-red-400 font-extrabold">
                    {quarteis.filter(q => q.subgrupamento === "2º SGB").map(q => (
                      <option key={q.id} value={q.id} className="bg-slate-800 text-white font-bold">
                        {q.nome}
                      </option>
                    ))}
                  </optgroup>
                  {quarteis.filter(q => q.subgrupamento !== "1º SGB" && q.subgrupamento !== "2º SGB").map(q => (
                    <option key={q.id} value={q.id} className="bg-slate-800 text-white">
                      {q.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Autenticação Administrador HUD */}
              {activeAdmin ? (
                <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-xl animate-fade-in">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-[11px] leading-tight">
                    <span className="text-[8px] uppercase font-bold text-emerald-500 block">ADMINISTRADOR</span>
                    <strong className="text-emerald-100 font-black truncate max-w-[120px] block">{activeAdmin.nome}</strong>
                  </div>
                  <div className="flex items-center gap-1 ml-1 pl-2 border-l border-emerald-500/10">
                    <button 
                      onClick={() => setRegisterModalOpen(true)}
                      className="p-1 hover:bg-white/5 rounded-md transition"
                      title="Cadastrar Novo Administrador"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-zinc-400 hover:text-white" />
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="p-1 hover:bg-red-500/10 rounded-md transition"
                      title="Sair do Modo Administrador"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-400 hover:text-red-350" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/25 px-3 py-1.5 rounded-xl">
                  <div className="text-right leading-tight">
                    <span className="text-[9px] font-black text-amber-555 text-amber-500 uppercase tracking-tight block">MODO CONSULTA</span>
                    <span className="text-[8px] text-zinc-400 block mt-0.5">Somente Leitura</span>
                  </div>
                  <button 
                    onClick={() => {
                      setLoginUser("");
                      setLoginPass("");
                      setLoginError("");
                      setLoginModalOpen(true);
                    }}
                    className="ml-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[9.5px] px-2 py-1 rounded-lg transition shrink-0 uppercase tracking-wider cursor-pointer"
                  >
                    Entrar Admin
                  </button>
                </div>
              )}

              {/* Fire station clock countdown timer */}
              <div className="flex items-center gap-2 text-slate-300 font-mono text-xs font-bold bg-slate-950 px-3 py-1.5 rounded-xl">
                <Clock className="w-3.5 h-3.5 text-red-500" />
                <span>{currentTime || "Carregando..."}</span>
              </div>
            </div>

            {/* Hamburger menu */}
            <div className="lg:hidden flex items-center gap-2">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-300 hover:text-white"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Panel menu sliding drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 border-t border-slate-850 px-4 py-3 space-y-3 z-15 relative animate-fade-in">
            
            {/* Pelotão Select mobile */}
            <div className="bg-slate-800 px-3.5 py-2 rounded-xl flex items-center justify-between border border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase">PELOTÃO OPERANTE:</span>
              <select 
                className="bg-transparent text-xs font-bold text-white focus:outline-none max-w-[170px]"
                value={selectedQuartelId}
                onChange={(e) => setSelectedQuartelId(e.target.value)}
              >
                <optgroup label="1º Subgrupamento (1º SGB)" className="text-red-500 font-bold bg-slate-900">
                  {quarteis.filter(q => q.subgrupamento === "1º SGB").map(q => (
                    <option key={q.id} value={q.id} className="text-slate-900">{q.nome}</option>
                  ))}
                </optgroup>
                <optgroup label="2º Subgrupamento (2º SGB)" className="text-red-500 font-bold bg-slate-900">
                  {quarteis.filter(q => q.subgrupamento === "2º SGB").map(q => (
                    <option key={q.id} value={q.id} className="text-slate-900">{q.nome}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Mobile Admin hud control */}
            <div className="p-1 border-t border-b border-white/5 py-2">
              {activeAdmin ? (
                <div className="flex justify-between items-center bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/20 text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-emerald-500 block">ADMIN ATIVO</span>
                    <strong className="text-white font-extrabold">{activeAdmin.nome}</strong>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setRegisterModalOpen(true);
                      }}
                      className="bg-zinc-800 hover:bg-zinc-750 text-white px-2 py-1 text-[10px] rounded-lg cursor-pointer"
                    >
                      + Admin
                    </button>
                    <button 
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="bg-red-650 bg-red-600 hover:bg-red-700 text-white px-2 py-1 text-[10px] rounded-lg font-bold cursor-pointer"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/25 text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-amber-500 block text-left">MODO CONSULTA</span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">Sem permissão de alterações</span>
                  </div>
                  <button 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setLoginUser("");
                      setLoginPass("");
                      setLoginError("");
                      setLoginModalOpen(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] px-3 py-1.5 rounded-lg uppercase tracking-wider transition cursor-pointer"
                  >
                    Entrar Admin
                  </button>
                </div>
              )}
            </div>

            {/* Tab links mobile */}
            <div className="flex flex-col gap-1">
              {[
                { id: "dashboard", label: "Painel Operacional", icon: MessageSquare },
                { id: "escalas", label: "Escalas de Serviço", icon: Calendar },
                { id: "fmos_dashboard", label: "Folgas Obrigatórias (FMO)", icon: Award },
                { id: "efetivo", label: "Efetivo Militar", icon: Users },
                { id: "frequencia", label: "Controle de Frequência", icon: FileSpreadsheet }
              ].map((tab) => {
                const Icon = tab.icon;
                const isSel = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-xs text-left ${isSel ? "bg-red-650 bg-red-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="font-mono text-[10px] text-center text-slate-500 py-1 border-t border-slate-800">
              Hora: {currentTime}
            </div>
          </div>
        )}
      </header>

      {/* MODAL DE LOGIN ADMINISTRADOR */}
      {loginModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-[#161618] border border-white/5 shadow-2xl rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black uppercase text-amber-500 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                Acesso Administrativo SGB
              </h3>
              <button 
                onClick={() => setLoginModalOpen(false)}
                className="text-zinc-500 hover:text-white text-xs px-2 py-0.5 rounded-md cursor-pointer transition font-mono font-bold"
              >
                X
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5 pt-1">
              {loginError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2.5 rounded-xl text-xs font-semibold">
                  ⚠️ {loginError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Usuário Administrador</label>
                <input 
                  type="text" 
                  placeholder="Ex: admin"
                  className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-zinc-650 focus:outline-none font-bold"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Senha de Segurança</label>
                <input 
                  type="password" 
                  placeholder="Insira a senha do 20º GB"
                  className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-zinc-650 focus:outline-none"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  required
                />
              </div>

              <div className="text-[10px] text-zinc-500 leading-tight">
                * Senha de fábrica inicial: <code className="bg-[#111113] px-1 py-0.5 text-zinc-300 rounded">sgb20gb</code>. Administradores podem registrar novos delegados após acessar.
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition tracking-wide uppercase mt-1 cursor-pointer"
              >
                Autenticar e Entrar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO ADMINISTRADOR */}
      {registerModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-[#161618] border border-white/5 shadow-2xl rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black uppercase text-emerald-500 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-500" />
                Novo Administrador SGB
              </h3>
              <button 
                onClick={() => {
                  setRegisterModalOpen(false);
                  setRegError("");
                  setRegSuccess("");
                }}
                className="text-zinc-500 hover:text-white text-xs px-2 py-0.5 rounded-md cursor-pointer transition font-mono font-bold"
              >
                X
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-3.5 pt-1">
              {regError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2.5 rounded-xl text-xs font-semibold">
                  ⚠️ {regError}
                </div>
              )}

              {regSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-xl text-xs font-semibold">
                  ✅ {regSuccess}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Nome de Guerra / Identificação</label>
                <input 
                  type="text" 
                  placeholder="Ex: Sgt PM Silva"
                  className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-zinc-650 focus:outline-none"
                  value={regNome}
                  onChange={(e) => setRegNome(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Usuário (Username)</label>
                <input 
                  type="text" 
                  placeholder="Ex: silva"
                  className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-zinc-650 focus:outline-none"
                  value={regUser}
                  onChange={(e) => setRegUser(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Senha do Administrador</label>
                <input 
                  type="password" 
                  placeholder="Senha para este administrador"
                  className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-zinc-650 focus:outline-none"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition tracking-wide uppercase mt-1 cursor-pointer"
              >
                Registrar Acesso
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 shrink-0">
        
        {/* Render active sub-view module */}
        {activeTab === "dashboard" && (
          <Dashboard 
            selectedQuartelId={selectedQuartelId}
            bombeiros={bombeiros}
            escalas={escalas}
            viaturas={viaturas}
            mural={mural}
            afastamentos={afastamentos}
            fmos={fmos}
            dbStatus={dbStatus}
            onCreateMural={handleCreateMural}
            onDeleteMural={handleDeleteMural}
            onUpdateViaturaStatus={handleUpdateViaturaStatus}
            onAddAfastamento={handleAddAfastamento}
            onDeleteAfastamento={handleSilentDeleteAfastamento}
            isAdmin={activeAdmin !== null}
          />
        )}

        {activeTab === "escalas" && (
          <EscalasManager 
            selectedQuartelId={selectedQuartelId}
            quarteis={quarteis}
            bombeiros={bombeiros}
            escalas={escalas}
            onAddEscala={handleAddEscala}
            onDeleteEscala={handleDeleteEscala}
            afastamentos={afastamentos}
            fmos={fmos}
            isAdmin={activeAdmin !== null}
          />
        )}

        {activeTab === "efetivo" && (
          <EfetivoManager
            selectedQuartelId={selectedQuartelId}
            quarteis={quarteis}
            bombeiros={bombeiros}
            onAddBombeiro={handleAddBombeiro}
            onDeleteBombeiro={handleDeleteBombeiro}
            isAdmin={activeAdmin !== null}
          />
        )}

        {activeTab === "frequencia" && (
          <FrequenciaManager
            selectedQuartelId={selectedQuartelId}
            quarteis={quarteis}
            bombeiros={bombeiros}
            escalas={escalas}
            afastamentos={afastamentos}
            fmos={fmos}
            onAddAfastamento={handleAddAfastamento}
            onDeleteAfastamento={handleDeleteAfastamento}
            onAddFmo={handleAddFmo}
            onDeleteFmo={handleDeleteFmo}
            onAddEscala={handleAddEscala}
            onDeleteEscala={handleDeleteEscala}
            isAdmin={activeAdmin !== null}
          />
        )}

        {activeTab === "fmos_dashboard" && (
          <FmosDashboard
            selectedQuartelId={selectedQuartelId}
            bombeiros={bombeiros}
            afastamentos={afastamentos}
            fmos={fmos}
            onAddFmo={handleAddFmo}
            onDeleteFmo={handleDeleteFmo}
            isAdmin={activeAdmin !== null}
          />
        )}

      </main>

      {/* SGB Operational Footer */}
      <footer className="bg-[#0a0a0b] border-t border-white/5 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7a7a7f] mt-auto no-print">
        <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
          <span>pbandradina / sgb-multi-tenant</span>
          <span className="font-mono text-white/20">Branch: main</span>
          <span className="font-mono text-emerald-500/80">Connected: {dbStatus.connected ? "Supabase Cloud" : "Local Database"}</span>
        </div>
        <div className="mt-2 sm:mt-0 font-medium text-center sm:text-right">
          © 2026 Sistema de Gestão de Bombeiros • Estado de São Paulo
        </div>
      </footer>

    </div>
  );
}
