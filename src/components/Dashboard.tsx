import React, { useState } from "react";
import { 
  Flame, Users, Clock, Truck, ShieldAlert, Plus, Trash2, 
  Database, MapPin, Phone, AlertTriangle, CheckCircle, 
  MessageSquare, UserCheck, ChevronRight, ChevronLeft, Calendar
} from "lucide-react";
import { Bombeiro, Escala, Viatura, Ocorrencia, MuralPost, Afastamento, Fmo } from "../types";

const formatDate = (d: Date | string) => {
  return new Date(d).toISOString().split("T")[0];
};

interface DashboardProps {
  selectedQuartelId: string;
  bombeiros: Bombeiro[];
  escalas: Escala[];
  viaturas: Viatura[];
  mural: MuralPost[];
  afastamentos?: Afastamento[];
  fmos?: Fmo[];
  dbStatus: { connected: boolean; database: string };
  onCreateMural: (title: string, content: string, re: string) => Promise<void>;
  onDeleteMural: (id: string) => Promise<void>;
  onUpdateViaturaStatus: (id: string, status: string, escala_atual: string) => Promise<void>;
  onAddAfastamento?: (data: Omit<Afastamento, "id">) => Promise<void>;
  onDeleteAfastamento?: (id: string) => Promise<void>;
  isAdmin?: boolean;
}

export default function Dashboard({
  selectedQuartelId,
  bombeiros,
  escalas,
  viaturas,
  mural,
  afastamentos = [],
  fmos = [],
  dbStatus,
  onCreateMural,
  onDeleteMural,
  onUpdateViaturaStatus,
  onAddAfastamento,
  onDeleteAfastamento,
  isAdmin = false
}: DashboardProps) {
  // For Quick Notice
  const [newNoticeTitle, setNewNoticeTitle] = useState("");
  const [newNoticeContent, setNewNoticeContent] = useState("");
  const [noticeAuthorRe, setNoticeAuthorRe] = useState("");
  const [isSubmitNoticeLoading, setIsSubmitNoticeLoading] = useState(false);

  // Interactive Date Selector for Shift Roster & Admin Card
  const [dashboardDate, setDashboardDate] = useState<Date>(() => new Date());

  const handlePrevDay = () => {
    setDashboardDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  };

  const handleNextDay = () => {
    setDashboardDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const getProntidaoDoDia = (date: Date) => {
    const reference = new Date(2026, 0, 1).getTime();
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.round((target - reference) / (1000 * 60 * 60 * 24));
    const idx = ((diffDays % 3) + 3) % 3;
    const choices = [
      { name: "VERDE", color: "bg-emerald-600", border: "border-emerald-500/30", text: "text-emerald-500", bg: "bg-emerald-50 text-emerald-800 border-emerald-100" },
      { name: "AMARELA", color: "bg-yellow-500", border: "border-yellow-500/30", text: "text-yellow-600", bg: "bg-yellow-50 text-yellow-800 border-yellow-100" },
      { name: "AZUL", color: "bg-blue-600", border: "border-blue-500/30", text: "text-blue-500", bg: "bg-blue-50 text-blue-800 border-blue-100" }
    ];
    return choices[idx];
  };

  const activeProntidao = getProntidaoDoDia(dashboardDate);
  const dateStr = formatDate(dashboardDate);

  // Filter items specifically for the active selected station (Multi-tenant)
  const activeBombeiros = bombeiros.filter(b => b.quartel_id === selectedQuartelId);
  const activeViaturas = viaturas.filter(v => v.quartel_id === selectedQuartelId);
  const activeMural = mural.filter(m => m.quartel_id === selectedQuartelId);

  // Active scales for today (standard overview for statistics)
  const todayStr = new Date().toISOString().split("T")[0];
  const activeEscalasHoje = escalas.filter(
    e => e.quartel_id === selectedQuartelId && e.data === todayStr
  );

  // Month-based indicators (Focusing strictly on hours and volume of services)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = 2026; // Match state years

  const escalasMes = escalas.filter(e => {
    if (e.quartel_id !== selectedQuartelId) return false;
    const dStr = e.data; // "YYYY-MM-DD"
    const d = new Date(dStr + "T00:00:00");
    return (d.getMonth() + 1) === currentMonth && d.getFullYear() === currentYear;
  });

  let totalHorasTrabalhadasMes = 0;
  let totalPlantoesMes = 0;

  escalasMes.forEach(p => {
    const bombeiro = bombeiros.find(b => b.id === p.bombeiro_id);
    if (!bombeiro) return;

    totalPlantoesMes++;
    if (p.periodo === "24h") {
      totalHorasTrabalhadasMes += 24;
    } else if (p.periodo === "Noturno 12h") {
      totalHorasTrabalhadasMes += 12;
    } else if (p.periodo === "Diurno 12h") {
      totalHorasTrabalhadasMes += 12;
    } else {
      totalHorasTrabalhadasMes += 12;
    }
  });

  const stats = {
    efetivoAtivo: activeBombeiros.filter(b => b.status === "Ativo").length,
    efetivoDeServico: activeEscalasHoje.length,
    viaturasProntas: activeViaturas.filter(v => v.status === "Pronta para Serviço").length,
    horasTrabalhadasMes: totalHorasTrabalhadasMes,
    plantoesMes: totalPlantoesMes,
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle || !newNoticeContent) return;
    setIsSubmitNoticeLoading(true);
    try {
      await onCreateMural(newNoticeTitle, newNoticeContent, noticeAuthorRe);
      setNewNoticeTitle("");
      setNewNoticeContent("");
      setNoticeAuthorRe("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitNoticeLoading(false);
    }
  };

  // Helper to check standard absence string
  const getBombeiroAbsence = (bombeiroId: string) => {
    const af = afastamentos.find(a => 
      a.bombeiro_id === bombeiroId && 
      dateStr >= a.data_inicio && 
      dateStr <= a.data_fim
    );
    if (af) {
      return `Afastado (${af.tipo})`;
    }
    const f = fmos.find(fm => fm.bombeiro_id === bombeiroId && fm.data === dateStr);
    if (f) {
      return `FMO (Folga Obrigatória)`;
    }
    return null;
  };

  // Determine active personnel for the interactive Prontidão Card:
  const escalasDoDia = escalas.filter(
    e => e.quartel_id === selectedQuartelId && e.data === dateStr
  );

  let prontidaoFighters: { bombeiro: Bombeiro; funcao: string; statusLabel?: string; id_escala?: string }[] = [];

  if (escalasDoDia.length > 0) {
    // Scales have been registered explicitly
    prontidaoFighters = escalasDoDia.map(escala => {
      const bombeiro = bombeiros.find(b => b.id === escala.bombeiro_id);
      const absence = bombeiro ? getBombeiroAbsence(bombeiro.id) : null;
      return {
        bombeiro: bombeiro!,
        funcao: escala.funcao,
        statusLabel: absence || undefined,
        id_escala: escala.id
      };
    }).filter(item => item.bombeiro !== undefined);
  } else {
    // Fallback to computed shift group (regular crew for that day cycle)
    const regularCrew = activeBombeiros.filter(
      b => (b.regime || "PRONTIDÃO") === "PRONTIDÃO" && b.equipe === activeProntidao.name
    );

    prontidaoFighters = regularCrew.map(bombeiro => {
      const absence = getBombeiroAbsence(bombeiro.id);
      return {
        bombeiro,
        funcao: (bombeiro.posto_grad.includes("Tenente") || bombeiro.posto_grad.includes("Capitão") || bombeiro.posto_grad.includes("Subtenente")) 
          ? "Comandante Operacional" 
          : "Socorrista / Linha de Combate",
        statusLabel: absence || undefined
      };
    });
  }

  // Filter administrative firefighters (Expediente regime)
  const adminBombeiros = activeBombeiros.filter(b => b.regime === "EXPEDIENTE");
  const isWeekend = dashboardDate.getDay() === 0 || dashboardDate.getDay() === 6;

  // Handle Administrative leave changes
  const handleAdminLeaveChange = async (bombeiroId: string, value: string) => {
    if (!onAddAfastamento || !onDeleteAfastamento) return;
    try {
      // Find matches for same exact firefighter on same date
      const existingLeaves = afastamentos.filter(af => 
        af.bombeiro_id === bombeiroId && 
        dateStr >= af.data_inicio && 
        dateStr <= af.data_fim
      );

      // Clean old records
      for (const leaf of existingLeaves) {
        await onDeleteAfastamento(leaf.id);
      }

      // Record new leave
      if (value !== "TRABALHANDO") {
        let tipo = "";
        let justificativa = "Dispensa/Folga de Expediente Administrativo";
        
        if (value === "AGLUTINADA") {
          tipo = "Folga Aglutinada";
          justificativa = "Folga de expediente em modalidade aglutinada";
        } else if (value === "MEIO_MANHA") {
          tipo = "Meio Expediente (Manhã - 08h às 13h)";
          justificativa = "Dispensa por meio expediente das 08:00h às 13:00h";
        } else if (value === "MEIO_TARDE") {
          tipo = "Meio Expediente (Tarde - 13h às 18h)";
          justificativa = "Dispensa por meio expediente das 13:00h às 18:00h";
        }

        if (tipo) {
          await onAddAfastamento({
            quartel_id: selectedQuartelId,
            bombeiro_id: bombeiroId,
            data_inicio: dateStr,
            data_fim: dateStr,
            tipo,
            justificativa
          });
        }
      }
    } catch (e) {
      console.error("Erro ao alterar folga administrativa:", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time DB Status & Title banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-red-600 opacity-10 rounded-full blur-2xl"></div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 z-10 relative">
          <div>
            <div className="flex items-center gap-2 text-red-500 font-semibold tracking-wider text-xs uppercase mb-1">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Painel de Controle em Tempo Real
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              SGB Multi-Tenant
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Gerencie escalas físicas, viaturas e efetivo operacional simultaneamente.
            </p>
          </div>

          {/* Database Connection HUD */}
          <div className="bg-slate-800/80 backend-connection-status rounded-xl p-3 border border-slate-700/50 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${dbStatus.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
              <Database className="w-5 h-5" />
            </div>
            <div className="text-left text-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <span className={`w-2 h-2 rounded-full ${dbStatus.connected ? "bg-emerald-400" : "bg-blue-400 animate-pulse"}`}></span>
                {dbStatus.connected ? "SUPABASE CONECTADO" : "SALA LOCAL SEGURA"}
              </div>
              <div className="text-slate-400 font-mono text-[10px] truncate max-w-[200px]" title={dbStatus.database}>
                {dbStatus.connected ? "PostgreSQL Proativo Ativado" : "Desenvolvimento Sem Fio"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Key Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Core Stat 1: Combat Officers Active */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 transition hover:shadow-md">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.efetivoAtivo}</div>
            <div className="text-xs text-slate-500 font-medium leading-tight">Efetivo Cadastrado</div>
          </div>
        </div>

        {/* Core Stat 2: Active Roster Duty Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 transition hover:shadow-md">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.efetivoDeServico}</div>
            <div className="text-xs text-slate-500 font-medium leading-tight">Membros de Plantão Hoje</div>
          </div>
        </div>

        {/* Core Stat 3: Vehicle Readiness Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 transition hover:shadow-md">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.viaturasProntas} / {activeViaturas.length}</div>
            <div className="text-xs text-slate-500 font-medium leading-tight">Viaturas Prontas</div>
          </div>
        </div>

        {/* Core Stat 4: Volume de Plantões do Mês */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 transition hover:shadow-md">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.horasTrabalhadasMes}h</div>
            <div className="text-xs text-slate-500 font-medium leading-tight">Horas de Prontidão (Mês)</div>
          </div>
        </div>
      </div>

      {/* Main Core View Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Columns: Firefighters on duty & Fleet readiness */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Active Shift List Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <UserCheck className="text-red-500 w-5 h-5" />
                  Prontidão de Serviço hoje
                </h2>
                <p className="text-xs text-slate-500">
                  Operacionais de prontidão atrelados ao ciclo e escalas específicas.
                </p>
              </div>

              {/* Day controller chevron controls */}
              <div className="flex items-center gap-1.5 self-start sm:self-center pr-2 bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={handlePrevDay}
                  className="p-1 px-1.5 hover:bg-white rounded hover:text-slate-900 text-slate-500 transition-colors shadow-none hover:shadow-2xs cursor-pointer text-xs flex items-center gap-0.5"
                  title="Dia anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-xs font-black px-2 text-slate-800 flex items-center gap-1 sm:min-w-[130px] justify-center tracking-tight">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(dashboardDate).toLocaleDateString("pt-BR", { day: 'numeric', month: 'short' })}
                </div>
                <button 
                  onClick={handleNextDay}
                  className="p-1 px-1.5 hover:bg-white rounded hover:text-slate-900 text-slate-500 transition-colors shadow-none hover:shadow-2xs cursor-pointer text-xs flex items-center gap-0.5"
                  title="Próximo dia"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scale team indicators */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-slate-400 font-bold">Ciclo Geral:</span>
              {["VERDE", "AMARELA", "AZUL"].map(colorName => {
                const isCurrent = activeProntidao.name === colorName;
                return (
                  <span
                    key={colorName}
                    className={`px-3 py-1 rounded-full text-xs font-black tracking-wider transition ${
                      isCurrent 
                        ? (colorName === "VERDE" ? "bg-emerald-600 text-white shadow-sm" : colorName === "AMARELA" ? "bg-amber-400 text-slate-900 shadow-sm" : "bg-blue-600 text-white shadow-sm")
                        : "bg-slate-100 text-slate-400 border border-transparent"
                    }`}
                  >
                    {colorName} {isCurrent ? "● ATIVA" : ""}
                  </span>
                );
              })}
            </div>

            {prontidaoFighters.length === 0 ? (
              <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Users className="w-10 h-10 mx-auto text-slate-330 mb-2" />
                <p className="text-sm font-semibold">Sem membros de serviço operacional escalados</p>
                <p className="text-xs text-slate-400">Verifique o regime e folgas dos operacionais no cadastro.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {prontidaoFighters.map((item, idx) => {
                  const b = item.bombeiro;
                  return (
                    <div 
                      key={idx} 
                      className="p-3 border border-slate-100 bg-slate-50/50 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full text-white font-black text-xs flex items-center justify-center border-2 border-red-500 uppercase ${
                          b.equipe === "VERDE" ? "bg-emerald-600" :
                          b.equipe === "AMARELA" ? "bg-amber-500" :
                          b.equipe === "AZUL" ? "bg-blue-600" : "bg-slate-805 bg-slate-800"
                        }`}>
                          {b.posto_grad.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">
                            {b.nome_guerra} <span className="font-mono text-[10px] text-slate-400">({b.re})</span>
                          </div>
                          <div className={`text-xs font-semibold ${item.statusLabel ? "text-red-500 italic" : "text-slate-500"}`}>
                            {item.statusLabel || item.funcao}
                          </div>
                        </div>
                      </div>
                      
                      {b.equipe && (
                        <span className={`px-2 py-0.5 font-bold rounded-sm text-[10px] uppercase font-mono ${
                          b.equipe === "VERDE" ? "bg-emerald-100 text-emerald-800" :
                          b.equipe === "AMARELA" ? "bg-yellow-100 text-yellow-800" :
                          "bg-blue-100 text-blue-800"
                        }`}>
                          {b.equipe}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Separate Administration Firefighter List Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <div className="border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-600 w-5 h-5" />
                Efetivo da Administração (Expediente)
              </h2>
              <p className="text-xs text-slate-500">
                Membros atrelados ao expediente administrativo semanal (segunda a sexta-feira das 08h às 18h).
              </p>
            </div>

            {adminBombeiros.length === 0 ? (
              <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm font-semibold">Sem bombeiros cadastrados na administração</p>
                <p className="text-xs text-slate-400">Ao cadastrar um bombeiro, selecione o regime EXPEDIENTE.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Information Header on current date */}
                {isWeekend && (
                  <div className="p-3 bg-slate-100 text-slate-600 rounded-xl text-xs text-center font-bold">
                    Faltando expediente de escala padrão: Fim de semana (Sábado/Domingo).
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {adminBombeiros.map(member => {
                    // Check current active leave status for member
                    const activeLeave = afastamentos.find(a => 
                      a.bombeiro_id === member.id && 
                      dateStr >= a.data_inicio && 
                      dateStr <= a.data_fim
                    );

                    let statusText = "Expediente Regular (08h às 18h)";
                    let statusColor = "text-indigo-600 bg-indigo-50 border-indigo-100";
                    let currentLeaveVal = "TRABALHANDO";

                    if (isWeekend) {
                      statusText = "Fim de Semana (Sem Expediente)";
                      statusColor = "text-slate-400 bg-slate-100 border-slate-200";
                    } else if (activeLeave) {
                      if (activeLeave.tipo === "Folga Aglutinada") {
                        statusText = "Folga Aglutinada (Dia Inteiro)";
                        statusColor = "text-red-600 bg-red-50 border-red-100 font-bold";
                        currentLeaveVal = "AGLUTINADA";
                      } else if (activeLeave.tipo === "Meio Expediente (Manhã - 08h às 13h)") {
                        statusText = "Opção de Meio Expediente: Folga de Manhã (08h - 13h)";
                        statusColor = "text-amber-600 bg-amber-50 border-amber-100 font-bold";
                        currentLeaveVal = "MEIO_MANHA";
                      } else if (activeLeave.tipo === "Meio Expediente (Tarde - 13h às 18h)") {
                        statusText = "Opção de Meio Expediente: Folga de Tarde (13h - 18h)";
                        statusColor = "text-amber-600 bg-amber-50 border-amber-100 font-semibold";
                        currentLeaveVal = "MEIO_TARDE";
                      } else {
                        statusText = `${activeLeave.tipo}`;
                        statusColor = "text-red-700 bg-rose-50 border-rose-100 font-semibold";
                        currentLeaveVal = "OUTRO";
                      }
                    }

                    return (
                      <div 
                        key={member.id} 
                        className="p-3.5 border border-slate-100 bg-slate-50/20 hover:bg-slate-50/50 rounded-xl flex flex-col justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-start justify-between w-full">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center border border-indigo-200">
                              ADM
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-800">
                                {member.nome_guerra} <span className="font-mono text-[10px] text-slate-400 font-normal">({member.re})</span>
                              </div>
                              <span className="text-[10px] text-slate-400 italic block -mt-0.5">{member.nome}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Label */}
                        <div className={`px-2.5 py-1 rounded text-xs border ${statusColor}`}>
                          {statusText}
                        </div>

                        {/* Interactive schedule options */}
                        {!isWeekend && currentLeaveVal !== "OUTRO" && (
                          <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
                            <span className="text-[9px] uppercase font-extrabold text-slate-400">Modalidade de Folga / Expediente:</span>
                            <select
                              value={currentLeaveVal}
                              onChange={(e) => handleAdminLeaveChange(member.id, e.target.value)}
                              disabled={!isAdmin}
                              className={`w-full bg-white border border-slate-200 text-slate-700 text-xs py-1.5 px-2 rounded-lg font-bold focus:outline-none focus:border-indigo-500 cursor-pointer ${!isAdmin ? "opacity-75 cursor-not-allowed bg-slate-50" : ""}`}
                            >
                              <option value="TRABALHANDO">✓ Expediente Ativo (08h às 18h)</option>
                              <option value="AGLUTINADA">★ Folga Aglutinada (Dia Inteiro)</option>
                              <option value="MEIO_MANHA">☼ Folga Meio Período (Manhã: 08h às 13h)</option>
                              <option value="MEIO_TARDE">☾ Folga Meio Período (Tarde: 13h às 18h)</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fleets/Viaturas Board Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Truck className="text-red-500 w-5 h-5" />
                  Prontidão da Frota & Viaturas
                </h2>
                <p className="text-xs text-slate-500">
                  Gerencie o status e a tripulação instantânea dos veículos de combate e resgate.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeViaturas.map((viatura) => {
                const assignedIds = viatura.escala_atual ? viatura.escala_atual.split(",").filter(Boolean) : [];
                const crew = assignedIds.map(id => bombeiros.find(b => b.id === id)).filter(Boolean);

                // Get status configurations
                let statusBg = "bg-emerald-50 text-emerald-700 border-emerald-100";
                if (viatura.status === "Em Manutenção") statusBg = "bg-amber-50 text-amber-700 border-amber-100";
                if (viatura.status === "Em Ocorrência") statusBg = "bg-rose-50 text-rose-700 border-rose-100";

                return (
                  <div key={viatura.id} className="border border-slate-100 rounded-xl p-4 flex flex-col justify-between hover:shadow-xs transition bg-slate-50/10">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded text-xs">
                          {viatura.codigo}
                        </span>
                        <select 
                          className={`text-[10px] font-bold uppercase py-0.5 px-2 bg-white rounded border border-slate-200 outline-none text-slate-700 ${!isAdmin ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
                          value={viatura.status}
                          disabled={!isAdmin}
                          onChange={(e) => onUpdateViaturaStatus(viatura.id, e.target.value, viatura.escala_atual)}
                        >
                          <option value="Pronta para Serviço">Disponível</option>
                          <option value="Em Ocorrência">Em Combate</option>
                          <option value="Em Manutenção">Manutenção</option>
                        </select>
                      </div>

                      <h3 className="text-sm font-bold text-slate-700">{viatura.tipo}</h3>
                      
                      <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-150">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RECURSO TRIPULADO</div>
                        {crew.length === 0 ? (
                          <div className="text-xs text-slate-400 italic">Nenhum bombeiro acoplado</div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {crew.map(member => (
                              <span key={member?.id} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-semibold border border-slate-200">
                                {member?.nome_guerra}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${statusBg}`}>
                        {viatura.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right 1 Column: Quick Dispatch Form & Notice bulletin */}
        <div className="space-y-6">
          
          {/* Informative Scale and FMO guidelines Widget */}
          <div className="bg-[#1e1e24] text-white rounded-2xl shadow-xl p-6 border border-white/5 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 text-red-500 opacity-10 pointer-events-none">
              <Clock className="w-32 h-32" />
            </div>

            <div className="relative z-10">
              <h2 className="text-md font-extrabold tracking-tight flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-red-500" />
                Diretrizes de Escalas & Frequência
              </h2>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Instruções regulamentares de plantão operacional e salvaguardas de folga do efetivo militar.
              </p>

              <div className="space-y-2.5">
                {[
                  { label: "Carga Mensal", desc: "160 horas", detail: "Limite padrão de prontidão" },
                  { label: "Plantão Padrão", desc: "24h serv / 72h desc", detail: "Turno regular operacional" },
                  { label: "Garantia de FMO", desc: "Folga Mensal", detail: "Descanso obrigatório garantido" }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 bg-white/[0.03] rounded-lg border border-white/[0.05] text-xs">
                    <span className="font-bold text-white">{item.label}</span>
                    <div className="text-right font-mono">
                      <div className="font-semibold text-slate-200">{item.desc}</div>
                      <div className="text-[10px] text-slate-400">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-red-650 bg-red-600/10 border border-red-500/20 rounded-lg text-[11px] text-zinc-300 leading-relaxed font-medium">
                <strong>Análise de Conflitos:</strong> O sistema realiza validações em tempo real para evitar redundâncias, impedindo escalação de militares em períodos de férias, licenças médicas, ou dias reservados para FMO (Folga Mensal Obrigatória).
              </div>
            </div>
          </div>

          {/* Bulletin Board Panel */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <h2 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-4">
              <MessageSquare className="text-red-500 w-5 h-5" />
              Mural de Avisos Operacionais
            </h2>

            {/* Form to submit notice */}
            {isAdmin ? (
              <form onSubmit={handleCreateNotice} className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">NOVO AVISO COLETIVO</div>
                <input 
                  type="text" 
                  placeholder="Título do aviso" 
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-500 text-slate-800 font-medium"
                  value={newNoticeTitle}
                  onChange={(e) => setNewNoticeTitle(e.target.value)}
                  required
                />
                <textarea 
                  placeholder="Conteúdo detalhado da instrução..." 
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-red-500"
                  rows={2}
                  value={newNoticeContent}
                  onChange={(e) => setNewNoticeContent(e.target.value)}
                  required
                />
                <div className="flex gap-2 items-center justify-between">
                  <input 
                    type="text" 
                    placeholder="RE do Oficial (Sargento/Subten)" 
                    className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none w-1/2"
                    value={noticeAuthorRe}
                    onChange={(e) => setNoticeAuthorRe(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    disabled={isSubmitNoticeLoading}
                    className="bg-red-600 text-white hover:bg-red-700 px-3 py-1 text-xs font-bold rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Fixar
                  </button>
                </div>
              </form>
            ) : (
              <div className="mb-4 bg-amber-50/50 border border-amber-200/50 p-3 rounded-xl text-[11px] text-amber-700 font-medium flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Modo Leitura. Autentique como admin para lançar avisos.</span>
              </div>
            )}

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {activeMural.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">Sem avisos operacionais hoje.</p>
              ) : (
                activeMural.map((post) => (
                  <div key={post.id} className="p-3 border-l-4 border-red-500 bg-slate-50 rounded-r-lg shadow-2xs relative group">
                    {isAdmin && (
                      <button 
                        onClick={() => onDeleteMural(post.id)}
                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Deletar aviso"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <h3 className="font-bold text-xs text-slate-800 uppercase">{post.titulo}</h3>
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{post.conteudo}</p>
                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mt-2 pt-1 border-t border-slate-100">
                      <span>RESPONSÁVEL: {post.bombeiro_re || "Sede 1º GB"}</span>
                      <span>{new Date(post.criado_em).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
