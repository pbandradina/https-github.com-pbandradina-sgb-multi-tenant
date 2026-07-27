import React, { useState } from "react";
import { 
  Users, Calendar as CalendarIcon, Clock, DollarSign, Search, 
  Award, Shield, TrendingUp, CheckCircle2, AlertCircle, FileSpreadsheet, 
  Percent, Printer, CalendarRange, Plus, Trash2, CalendarDays, AlertTriangle,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { Bombeiro, Escala, Quartel, Afastamento, Fmo } from "../types";
import {
  MESES_OPTIONS,
  buildDateKey,
  formatDateBR,
  getDaysInMonth,
  getFirstWeekdayOfMonth,
  isDateKeyInMonth,
  isDateKeyInRange
} from "../lib/dates";
import { LIMITE_HORAS_MES, PERIODOS_ESCALA, horasDoPeriodo, periodoAbrev } from "../lib/escalas";
import { EquipeProntidao, getProntidaoDoDiaKey } from "../lib/prontidao";
import {
  contarDiasAfastados,
  filterAfastamentosDoMes,
  filterFmosDoMes,
  findAfastamentoNaData,
  findFmoNaData
} from "../lib/frequencia";

const ESTILOS_PRONTIDAO: Record<EquipeProntidao, { text: string; bg: string; border: string }> = {
  VERDE: { text: "text-emerald-400 bg-emerald-500/10 border-emerald-500/35", bg: "bg-emerald-600", border: "border-emerald-500" },
  AMARELA: { text: "text-amber-400 bg-amber-500/10 border-amber-500/35", bg: "bg-yellow-500", border: "border-yellow-500" },
  AZUL: { text: "text-blue-400 bg-blue-500/10 border-blue-500/30", bg: "bg-blue-600", border: "border-blue-500" }
};

interface FrequenciaManagerProps {
  selectedQuartelId: string;
  quarteis: Quartel[];
  bombeiros: Bombeiro[];
  escalas: Escala[];
  afastamentos: Afastamento[];
  fmos: Fmo[];
  onAddAfastamento: (data: Omit<Afastamento, "id">) => Promise<void>;
  onDeleteAfastamento: (id: string) => Promise<void>;
  onAddFmo: (data: Omit<Fmo, "id">) => Promise<void>;
  onDeleteFmo: (id: string) => Promise<void>;
  onAddEscala?: (data: Omit<Escala, "id">) => Promise<void>;
  onDeleteEscala?: (id: string) => Promise<void>;
  isAdmin?: boolean;
}

export default function FrequenciaManager({
  selectedQuartelId,
  quarteis,
  bombeiros,
  escalas,
  afastamentos,
  fmos,
  onAddAfastamento,
  onDeleteAfastamento,
  onAddFmo,
  onDeleteFmo,
  onAddEscala,
  onDeleteEscala,
  isAdmin = false
}: FrequenciaManagerProps) {
  // Navigation tabs of Freq Module
  const [activeSubTab, setActiveSubTab] = useState<"sumula" | "calendario" | "afastamentos">("sumula");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(2026);

  // States for interactive calendar & matrix board
  const [calendarViewMode, setCalendarViewMode] = useState<"grid" | "matrix">("matrix");
  const [activeCellModal, setActiveCellModal] = useState<{
    bombeiroId: string; // or "all"
    dateStr: string;
  } | null>(null);

  // Modal input fields
  const [modalSelection, setModalSelection] = useState<"escala" | "fmo" | "afastamento">("escala");
  const [modalEscalaFuncao, setModalEscalaFuncao] = useState("Auxiliar de Bomba & Linha de Combate");
  const [modalEscalaPeriodo, setModalEscalaPeriodo] = useState("24h");
  const [modalFmoJustificativa, setModalFmoJustificativa] = useState("");
  const [modalAfTipo, setModalAfTipo] = useState("Férias");
  const [modalAfFim, setModalAfFim] = useState("");
  const [modalAfJustificativa, setModalAfJustificativa] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMilitarId, setModalMilitarId] = useState("");

  // Focus filter for interactive calendar
  const [focusedBombeiroId, setFocusedBombeiroId] = useState<string>("all");

  // Form states for Afastamento
  const [afMilitarId, setAfMilitarId] = useState("");
  const [afTipo, setAfTipo] = useState("Férias");
  const [afInicio, setAfInicio] = useState("");
  const [afFim, setAfFim] = useState("");
  const [afJustificativa, setAfJustificativa] = useState("");
  const [afFormError, setAfFormError] = useState<string | null>(null);
  const [afFormSuccess, setAfFormSuccess] = useState(false);

  // Form states for FMO
  const [fmoMilitarId, setFmoMilitarId] = useState("");
  const [fmoData, setFmoData] = useState("");
  const [fmoJustificativa, setFmoJustificativa] = useState("");
  const [fmoFormError, setFmoFormError] = useState<string | null>(null);
  const [fmoFormSuccess, setFmoFormSuccess] = useState(false);

  const activeQuartel = quarteis.find(q => q.id === selectedQuartelId);
  const activeBombeiros = bombeiros.filter(b => b.quartel_id === selectedQuartelId);

  // Filter scales, fmos and absences based on active tenant station
  const stationEscalas = escalas.filter(e => e.quartel_id === selectedQuartelId);
  const stationAfastamentos = afastamentos.filter(a => a.quartel_id === selectedQuartelId);
  const stationFmos = fmos.filter(f => f.quartel_id === selectedQuartelId);

  // Month options
  const meses = MESES_OPTIONS;

  // Check if a date string falls inside an absence period for a firefighter
  const checkIfMilitarAfastadoOnDate = (militarId: string, dateStr: string) =>
    findAfastamentoNaData(stationAfastamentos, militarId, dateStr);

  // Check if a militar has a programmed FMO on a specific date
  const checkIfMilitarHasFmoOnDate = (militarId: string, dateStr: string) =>
    findFmoNaData(stationFmos, militarId, dateStr);

  // Relação de conflitos pré-existentes na base para segurança operacional
  const activeConflicts: Array<{ militar: string; data: string; descricao: string; tipo: "afastamento" | "fmo" }> = [];

  stationEscalas.forEach(escala => {
    const militar = activeBombeiros.find(b => b.id === escala.bombeiro_id);
    if (!militar) return;

    // Conflito de Afastamento
    const abs = checkIfMilitarAfastadoOnDate(militar.id, escala.data);
    if (abs) {
      activeConflicts.push({
        militar: militar.nome_guerra,
        data: escala.data,
        descricao: `Escalado no período de ${abs.tipo} G.B. (${abs.data_inicio} a ${abs.data_fim})`,
        tipo: "afastamento"
      });
    }

    // Conflito de FMO
    const fmoCol = checkIfMilitarHasFmoOnDate(militar.id, escala.data);
    if (fmoCol) {
      activeConflicts.push({
        militar: militar.nome_guerra,
        data: escala.data,
        descricao: `Plantonista escalado em data reservada como FMO (Folga Obrigatória)`,
        tipo: "fmo"
      });
    }
  });

  // Compiled Statistics per firefighter with full respect to schedules, FMO, and leave days
  const folhaFrequencia = activeBombeiros.filter(b => (b.regime || "PRONTIDÃO") !== "EXPEDIENTE").map((bombeiro) => {
    // Find actual attendances scale shifts this month
    const plantoesMes = stationEscalas.filter(
      escala => escala.bombeiro_id === bombeiro.id && isDateKeyInMonth(escala.data, selectedMonth, selectedYear)
    );

    // Absences that fall in this month
    const afastamentosNoMes = filterAfastamentosDoMes(stationAfastamentos, bombeiro.id, selectedMonth, selectedYear);

    // FMOs generated in this month
    const fmosNoMes = filterFmosDoMes(stationFmos, bombeiro.id, selectedMonth, selectedYear);

    // Compute active hours of operational duty
    let horasTrabalhadas = 0;
    let horasNoturnas = 0;
    let plantoesContagem = 0;

    plantoesMes.forEach(p => {
      // Check if he was on absence on shift day (invalidates presence counts)
      const absInDay = checkIfMilitarAfastadoOnDate(bombeiro.id, p.data);
      if (absInDay) return; // Skip work count since he was absent/on leave

      plantoesContagem++;
      const { horas, horasNoturnas: noturnas } = horasDoPeriodo(p.periodo);
      horasTrabalhadas += horas;
      horasNoturnas += noturnas;
    });

    // Extra hours above the standard month duty limit
    const horasExcedentes = Math.max(0, horasTrabalhadas - LIMITE_HORAS_MES);

    // Deduções de Afastamento
    const diasAfastadosMesValue = contarDiasAfastados(afastamentosNoMes);

    return {
      bombeiro,
      plantoesMes,
      plantoesContagem,
      horasTrabalhadas,
      horasNoturnas,
      horasExcedentes,
      afastamentosNoMes,
      fmosNoMes,
      diasAfastados: diasAfastadosMesValue
    };
  }).filter(item => {
    const lower = searchTerm.toLowerCase();
    return (
      item.bombeiro.nome.toLowerCase().includes(lower) ||
      item.bombeiro.nome_guerra.toLowerCase().includes(lower) ||
      item.bombeiro.re.toLowerCase().includes(lower) ||
      item.bombeiro.posto_grad.toLowerCase().includes(lower)
    );
  });

  // Globals (Focused on pure operational statistics)
  const totalHorasGeraisDedicadas = folhaFrequencia.reduce((sum, item) => sum + item.horasTrabalhadas, 0);
  const totalHorasNoturnasGerais = folhaFrequencia.reduce((sum, item) => sum + item.horasNoturnas, 0);
  const totalHorasExcedentesGerais = folhaFrequencia.reduce((sum, item) => sum + item.horasExcedentes, 0);
  const totalPlantoesGerais = folhaFrequencia.reduce((sum, item) => sum + item.plantoesContagem, 0);
  const totalFmosGerais = folhaFrequencia.reduce((sum, item) => sum + item.fmosNoMes.length, 0);
  const totalDiasAfastadosGerais = folhaFrequencia.reduce((sum, item) => sum + item.diasAfastados, 0);

  const getProntidaoDoDiaStr = (dateStr: string) => {
    if (!dateStr) return { name: "", text: "border-transparent text-slate-500", bg: "", border: "" };
    const equipe = getProntidaoDoDiaKey(dateStr);
    return { name: equipe, ...ESTILOS_PRONTIDAO[equipe] };
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const startDayOfWeek = getFirstWeekdayOfMonth(selectedMonth, selectedYear);

  const daysGrid: Array<{ dateStr: string; dayNum: number | null }> = [];
  // Dummy empty spaces
  for (let i = 0; i < startDayOfWeek; i++) {
    daysGrid.push({ dateStr: "", dayNum: null });
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push({ dateStr: buildDateKey(selectedYear, selectedMonth, d), dayNum: d });
  }

  // Handle addition of Afastamento
  const handleCreateAfastamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setAfFormError(null);
    setAfFormSuccess(false);

    if (!afMilitarId || !afInicio || !afFim) {
      setAfFormError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (afFim < afInicio) {
      setAfFormError("A data de término do afastamento não pode ser anterior à data de início.");
      return;
    }

    // Safety checks for pre-existing scheduled duty scales in specified period
    const mil = activeBombeiros.find(b => b.id === afMilitarId);
    const scaleCollisions = stationEscalas.filter(
      esc => esc.bombeiro_id === afMilitarId && isDateKeyInRange(esc.data, afInicio, afFim)
    );

    let autoJust = afJustificativa;
    if (scaleCollisions.length > 0) {
      const datesObj = scaleCollisions.map(c => c.data).join(", ");
      const confirmProceed = confirm(
        `ALERTA DE CONFLITO MILITAR:\nO bombeiro ${mil?.nome_guerra} já está escalado para trabalhar nas seguintes datas: [${datesObj}].\n\nDeseja cadastrar o afastamento mesmo assim? O faturamento dessas datas será desabonado e as guarnições podem ficar incompletas.`
      );
      if (!confirmProceed) return;
      autoJust = `[SOBREPOSIÇÃO HOMOLOGADA] ${afJustificativa}`;
    }

    try {
      await onAddAfastamento({
        quartel_id: selectedQuartelId,
        bombeiro_id: afMilitarId,
        data_inicio: afInicio,
        data_fim: afFim,
        tipo: afTipo,
        justificativa: autoJust
      });
      setAfFormSuccess(true);
      setAfInicio("");
      setAfFim("");
      setAfJustificativa("");
    } catch {
      setAfFormError("Ocorreu uma falha ao persistir afastamento.");
    }
  };

  // Handle addition of FMO
  const handleCreateFmo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFmoFormError(null);
    setFmoFormSuccess(false);

    if (!fmoMilitarId || !fmoData) {
      setFmoFormError("Preencha todos os campos obrigatórios.");
      return;
    }

    const mil = activeBombeiros.find(b => b.id === fmoMilitarId);
    if (mil && mil.data_inicio_servico) {
      if (fmoData < mil.data_inicio_servico) {
        const formattedDate = formatDateBR(mil.data_inicio_servico);
        setFmoFormError(`Impossível homologar FMO neste dia: o militar iniciou o serviço ativo em ${formattedDate}. Por favor, escolha uma data igual ou posterior.`);
        return;
      }
    }

    // Validation: check scale on exact same day
    const scaleCollision = stationEscalas.find(esc => esc.bombeiro_id === fmoMilitarId && esc.data === fmoData);
    let autoJust = fmoJustificativa;

    if (scaleCollision) {
      const mil = activeBombeiros.find(b => b.id === fmoMilitarId);
      const confirmProceed = confirm(
        `CONFLITO GRÁFICO FMO:\nO militar ${mil?.nome_guerra} possui uma escala física de plantão ativa em ${fmoData} (${scaleCollision.periodo}).\n\nMarcar FMO neste mesmo dia irá gerar inconsistência de horas de escala. Deseja homologar a folga mesmo assim?`
      );
      if (!confirmProceed) return;
      autoJust = `[CONFLITO RESOLVIDO] ${fmoJustificativa}`;
    }

    try {
      await onAddFmo({
        quartel_id: selectedQuartelId,
        bombeiro_id: fmoMilitarId,
        data: fmoData,
        justificativa: autoJust
      });
      setFmoFormSuccess(true);
      setFmoData("");
      setFmoJustificativa("");
    } catch {
      setFmoFormError("Erro de comunicação com o banco ao registrar FMO.");
    }
  };

  // Modal Quick Action Add and Delete Handlers
  const handleModalAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCellModal) return;
    setModalError(null);
    setModalLoading(true);

    const targetBId = activeCellModal.bombeiroId === "all" ? modalMilitarId : activeCellModal.bombeiroId;
    const targetDate = activeCellModal.dateStr;

    if (!targetBId) {
      setModalError("Selecione um militar para continuar.");
      setModalLoading(false);
      return;
    }

    const milObj = activeBombeiros.find(b => b.id === targetBId);

    try {
      if (modalSelection === "escala") {
        if (!onAddEscala) {
          setModalError("Callback para escalação não disponível.");
          setModalLoading(false);
          return;
        }

        // Check if chronological consistency is met (not before admission date)
        if (milObj && milObj.data_inicio_servico && targetDate < milObj.data_inicio_servico) {
          const formattedDate = formatDateBR(milObj.data_inicio_servico);
          setModalError(`Erro: Militar ${milObj?.nome_guerra} iniciou serviço em ${formattedDate}. Impossível programar serviço em data anterior.`);
          setModalLoading(false);
          return;
        }

        const hasAbsence = checkIfMilitarAfastadoOnDate(targetBId, targetDate);
        if (hasAbsence) {
          const proceed = confirm(`ALERTA: ${milObj?.nome_guerra} está afastado nesta data por [${hasAbsence.tipo}]. Deseja ignorar e forçar a escala?`);
          if (!proceed) { setModalLoading(false); return; }
        }

        const hasFmo = checkIfMilitarHasFmoOnDate(targetBId, targetDate);
        if (hasFmo) {
          const proceed = confirm(`CONFLITO: ${milObj?.nome_guerra} tem Folga FMO para esse dia. Deseja anular a folga em escala e forçar o serviço?`);
          if (!proceed) { setModalLoading(false); return; }
        }

        await onAddEscala({
          quartel_id: selectedQuartelId,
          data: targetDate,
          bombeiro_id: targetBId,
          funcao: modalEscalaFuncao,
          periodo: modalEscalaPeriodo
        });
      } else if (modalSelection === "fmo") {
        if (milObj && milObj.data_inicio_servico && targetDate < milObj.data_inicio_servico) {
          const formattedDate = formatDateBR(milObj.data_inicio_servico);
          setModalError(`Erro: Militar ${milObj?.nome_guerra} iniciou o serviço ativo em ${formattedDate}. Escolha data igual ou posterior.`);
          setModalLoading(false);
          return;
        }

        const hasEscala = stationEscalas.find(es => es.bombeiro_id === targetBId && es.data === targetDate);
        if (hasEscala) {
          const proceed = confirm(`CONFLITO: ${milObj?.nome_guerra} possui escala de plantão nesta data. Marcar FMO irá gerar inconsistência. Deseja prosseguir de qualquer forma?`);
          if (!proceed) { setModalLoading(false); return; }
        }

        await onAddFmo({
          quartel_id: selectedQuartelId,
          bombeiro_id: targetBId,
          data: targetDate,
          justificativa: modalFmoJustificativa || "Inserido via Quadro Interativo"
        });
      } else if (modalSelection === "afastamento") {
        const dEnd = modalAfFim || targetDate;
        if (dEnd < targetDate) {
          setModalError("A data de término não pode ser anterior à data de início.");
          setModalLoading(false);
          return;
        }

        await onAddAfastamento({
          quartel_id: selectedQuartelId,
          bombeiro_id: targetBId,
          data_inicio: targetDate,
          data_fim: dEnd,
          tipo: modalAfTipo,
          justificativa: modalAfJustificativa || "Homologado via Quadro de Frequência"
        });
      }

      // Success Reset
      setActiveCellModal(null);
      setModalFmoJustificativa("");
      setModalAfFim("");
      setModalAfJustificativa("");
      setModalError(null);
    } catch (err: any) {
      console.error(err);
      setModalError("Erro ao registrar no banco.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalDeleteEscala = async (id: string) => {
    if (!onDeleteEscala) return;
    if (confirm("Remover esta escala operacional do militar?")) {
      await onDeleteEscala(id);
    }
  };

  const handleModalDeleteFmo = async (id: string) => {
    if (confirm("Remover esta folga obrigatória FMO?")) {
      await onDeleteFmo(id);
    }
  };

  const handleModalDeleteAfastamento = async (id: string) => {
    if (confirm("Remover este termo de afastamento?")) {
      await onDeleteAfastamento(id);
    }
  };

  const handlePrintFrequencia = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Upper header title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="text-red-500 w-7 h-7" />
            Demonstrativo de Frequência & Controle Operacional
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Gestão inteligente de escalas de plantão, faturamento mensal, homologação de FMO (Folga Mensal Obrigatória) e períodos de afastamento.
          </p>
        </div>

        <button
          onClick={handlePrintFrequencia}
          className="bg-red-600 border border-transparent hover:bg-red-700 text-white font-extrabold px-4 py-2 text-xs rounded-xl flex items-center gap-2 shadow-lg cursor-pointer transition no-print"
        >
          <Printer className="w-4 h-4" /> Imprimir Boletim de Súmula
        </button>
      </div>

      {/* Relação de conflitos alarmantes de serviço (No-print) */}
      {activeConflicts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 no-print flex gap-3 items-start animate-pulse">
          <AlertTriangle className="text-red-500 w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-extrabold text-red-400 uppercase tracking-widest block mb-1.5 text-[9px]">Atenção: Inconsistência de Escalas Detectada ({activeConflicts.length})</span>
            <div className="space-y-1 text-slate-300">
              {activeConflicts.slice(0, 3).map((con, i) => (
                <div key={i}>
                  • militar <strong className="text-white">{con.militar}</strong> em <span className="font-mono text-slate-200">{con.data}</span>: {con.descricao}
                </div>
              ))}
              {activeConflicts.length > 3 && (
                <div className="text-slate-400 italic">E mais {activeConflicts.length - 3} outros conflitos operacionais no período...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Roster parameters filter (Mês/Ano e Sub-abas) */}
      <div className="bg-[#161618] border border-white/5 rounded-2xl p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center no-print">
        
        {/* Menu de Sub-Abas */}
        <div className="lg:col-span-6 flex p-1 bg-[#111113] rounded-xl border border-white/5">
          <button
            onClick={() => setActiveSubTab("sumula")}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition text-center ${activeSubTab === "sumula" ? "bg-red-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
          >
            Súmula & Faturamento
          </button>
          <button
            onClick={() => setActiveSubTab("calendario")}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition text-center ${activeSubTab === "calendario" ? "bg-red-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
          >
            Calendário Mensal
          </button>
          <button
            onClick={() => setActiveSubTab("afastamentos")}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition text-center ${activeSubTab === "afastamentos" ? "bg-red-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
          >
            Afastamentos & FMO
          </button>
        </div>

        {/* Fatores do Mês */}
        <div className="lg:col-span-3 flex items-center justify-between bg-[#111113] border border-white/10 rounded-xl px-2 h-9 w-full">
          <button 
            type="button" 
            onClick={handlePrevMonth} 
            className="p-1.5 text-slate-400 hover:text-white transition hover:bg-white/5 rounded-lg cursor-pointer"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          
          <div className="flex items-center gap-1">
            <span className="text-xs font-black text-white uppercase tracking-wider">
              {meses.find(m => m.value === selectedMonth)?.label}
            </span>
            <span className="text-xs font-mono font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded cursor-default">
              {selectedYear}
            </span>
          </div>

          <button 
            type="button" 
            onClick={handleNextMonth} 
            className="p-1.5 text-slate-400 hover:text-white transition hover:bg-white/5 rounded-lg cursor-pointer"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Busca por Militar */}
        <div className="lg:col-span-3 relative">
          <Search className="absolute left-3.5 top-2.5 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nome ou RE..."
            className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

      </div>


      {/* VISUALIZAÇÃO 1: SÚMULA & FATURAMENTO */}
      {activeSubTab === "sumula" && (
        <div className="space-y-6">
          
          {/* Metrics indicators cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Hours Dedicated */}
            <div className="bg-[#161618] p-5 rounded-2xl border border-white/5 shadow-xs transition">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="text-xl font-black text-white">{totalHorasGeraisDedicadas}h</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Horas de Escala Computadas</div>
            </div>

            {/* Total Shifts */}
            <div className="bg-[#161618] p-5 rounded-2xl border border-white/5 shadow-xs transition">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="text-xl font-black text-white">{totalPlantoesGerais}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total de Plantões Escalados</div>
            </div>

            {/* FMO Compliance */}
            <div className="bg-[#161618] p-5 rounded-2xl border border-white/5 shadow-xs transition">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                  <CalendarIcon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-xl font-black text-white">{totalFmosGerais}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Folgas Obrigatórias (FMO)</div>
            </div>

            {/* Total Leave days */}
            <div className="bg-[#161618] p-5 rounded-2xl border border-white/5 shadow-xs transition">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                  <CalendarRange className="w-5 h-5" />
                </div>
              </div>
              <div className="text-xl font-black text-white">{totalDiasAfastadosGerais} dias</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dias de Afastamento (Mês)</div>
            </div>

          </div>

          {/* Main Roster Sheet Table */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-6 overflow-hidden">
            <div className="border-b border-white/5 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="text-red-500 w-5 h-5" />
                  Súmula Consolidada de Presença & Frequência
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Plantonistas do pelotão {activeQuartel?.nome} em {meses.find(m => m.value === selectedMonth)?.label} de {selectedYear}.
                </p>
              </div>
            </div>

            {folhaFrequencia.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto text-slate-500 mb-2" />
                <p className="text-sm font-semibold">Nenhum militar correspondente aos filtros de busca</p>
                <p className="text-xs text-slate-500">Cadastre escalas e gerencie afastamentos nas outras abas do painel.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/10 uppercase tracking-wider text-[10px] font-bold text-slate-400">
                      <th className="py-3 px-4">Graduação / Militar</th>
                      <th className="py-3 px-4 text-center">Escalas</th>
                      <th className="py-3 px-4 text-center">FMO (Concedida)</th>
                      <th className="py-3 px-4 text-center">Afastamento (Mês)</th>
                      <th className="py-3 px-4 text-center pr-6">Presenças (Hrs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-slate-300">
                    {folhaFrequencia.map((item) => {
                      const inactive = item.bombeiro.status !== "Ativo";
                      const fmoCount = item.fmosNoMes.length;
                      const hasAfastamentos = item.afastamentosNoMes.length > 0;

                      return (
                        <tr 
                          key={item.bombeiro.id} 
                          className="hover:bg-white/[0.01] transition"
                        >
                          <td className="py-4 px-4 font-bold text-white">
                            <span className="text-[11px] font-medium text-slate-400">{item.bombeiro.posto_grad}</span>
                            <div className="text-sm font-black text-slate-100">{item.bombeiro.nome_guerra}</div>
                            <div className="text-[9px] text-slate-500 font-mono">RE: {item.bombeiro.re}</div>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded-md font-mono font-bold">
                              {item.plantoesContagem}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-center">
                            {fmoCount > 0 ? (
                              <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded-md font-mono font-bold" title={item.fmosNoMes.map(f=>f.data).join(", ")}>
                                {fmoCount} FMO
                              </span>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Nenhuma</span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center">
                            {hasAfastamentos ? (
                              <span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded-md font-mono font-bold text-[10px]" title={item.afastamentosNoMes.map(a=>`${a.tipo} (${a.data_inicio} até ${a.data_fim})`).join(", ")}>
                                {item.diasAfastados}d ({item.afastamentosNoMes[0].tipo})
                              </span>
                            ) : (
                              <span className="text-slate-600 font-medium">0d</span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center pr-6 font-mono font-semibold text-slate-200">
                            {item.horasTrabalhadas}h
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}


      {/* VISUALIZAÇÃO 2: CALENDÁRIO MENSAL */}
      {activeSubTab === "calendario" && (
        <div className="bg-[#161618] border border-white/5 rounded-2xl p-6 space-y-6">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays className="text-red-500 w-5 h-5" />
                Quadro Mensal Interativo de Escalas
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Visualização do fluxo mensal de serviços e sobreposição de eventos táticos/afastamentos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Selector Mode Toggle */}
              <div className="flex bg-[#111113] p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setCalendarViewMode("grid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${calendarViewMode === "grid" ? "bg-red-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                >
                  Grade
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarViewMode("matrix")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${calendarViewMode === "matrix" ? "bg-red-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                >
                  Matriz SP
                </button>
              </div>

              {calendarViewMode === "grid" && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 font-bold uppercase shrink-0">Filtrar Militar:</label>
                  <select
                    className="bg-[#111113] border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white uppercase font-bold focus:outline-none"
                    value={focusedBombeiroId}
                    onChange={(e) => setFocusedBombeiroId(e.target.value)}
                  >
                    <option value="all">-- Todos os Militares --</option>
                    {activeBombeiros.map(b => (
                      <option key={b.id} value={b.id}>{b.nome_guerra} ({b.posto_grad})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Legend and helpers */}
          <div className="flex flex-col gap-2.5 bg-black/10 p-3 rounded-xl border border-white/[0.02] text-xs">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-red-600/30 border border-red-500/50 rounded-sm"></span>
                <span className="text-slate-300 font-semibold text-[11px]">Plantão Operativo (PL / Turnos)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-purple-700/30 border border-purple-500/40 rounded-sm"></span>
                <span className="text-slate-300 font-semibold text-[11px]">Folga Compensatória (FMO)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-amber-600/30 border border-amber-500/50 rounded-sm"></span>
                <span className="text-slate-300 font-semibold text-[11px]">Afastamento Ativo (Férias/Licenças)</span>
              </div>
              <div className="ml-auto text-[10px] text-slate-400 font-medium">
                💡 Clique em qualquer célula do quadro para lançar ou excluir afastamentos e turnos instantaneamente!
              </div>
            </div>
            <div className="flex flex-wrap gap-4 items-center border-t border-white/5 pt-2 text-[10px] text-slate-400">
              <span className="font-bold uppercase tracking-wider text-slate-500 text-[9px]">Molduras de Prontidão:</span>
              <div className="flex items-center gap-1.5 font-sans">
                <span className="px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[9px] font-black">SP VERDE</span>
              </div>
              <div className="flex items-center gap-1.5 font-sans">
                <span className="px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[9px] font-black">SP AMARELA</span>
              </div>
              <div className="flex items-center gap-1.5 font-sans">
                <span className="px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-400 text-[9px] font-black">SP AZUL</span>
              </div>
              <span className="text-[9.5px] italic ml-auto text-slate-450">As molduras ao redor dos números dos dias indicam a escala de equipes de Prontidão Ativa (Ciclo PMESP/CB).</span>
            </div>
          </div>

          {/* RENDER VIEW 1: TRADITIONAL GRID SELECTOR */}
          {calendarViewMode === "grid" && (
            <div className="grid grid-cols-7 gap-2">
              {/* Days of Week Headers */}
              {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((dw, i) => (
                <div key={i} className="text-center text-[10px] text-slate-400 uppercase font-black tracking-wider py-1 shrink-0 bg-white/[0.02] border border-white/[0.04] rounded-md">
                  {dw}
                </div>
              ))}

              {/* Calendar Cells */}
              {daysGrid.map((cell, idx) => {
                if (cell.dayNum === null) {
                  return (
                    <div key={idx} className="aspect-square bg-transparent border border-transparent rounded-xl shrink-0"></div>
                  );
                }

                const exactDateStr = cell.dateStr;

                // Grab event lists
                const dayEscalas = stationEscalas.filter(esc => esc.data === exactDateStr);
                const dayAfastamentos = stationAfastamentos.filter(ab =>
                  isDateKeyInRange(exactDateStr, ab.data_inicio, ab.data_fim)
                );
                const dayFmos = stationFmos.filter(fmo => fmo.data === exactDateStr);

                const filteredEscalas = focusedBombeiroId === "all" 
                  ? dayEscalas 
                  : dayEscalas.filter(e => e.bombeiro_id === focusedBombeiroId);

                const filteredAfastamentos = focusedBombeiroId === "all"
                  ? dayAfastamentos
                  : dayAfastamentos.filter(a => a.bombeiro_id === focusedBombeiroId);

                const filteredFmos = focusedBombeiroId === "all"
                  ? dayFmos
                  : dayFmos.filter(f => f.bombeiro_id === focusedBombeiroId);

                const hasDuty = filteredEscalas.length > 0;
                const hasAbsence = filteredAfastamentos.length > 0;

                const prontidao = getProntidaoDoDiaStr(exactDateStr);

                return (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setModalMilitarId("");
                      setModalAfFim(exactDateStr);
                      setActiveCellModal({ bombeiroId: "all", dateStr: exactDateStr });
                    }}
                    className={`cursor-pointer aspect-square p-2 border rounded-xl flex flex-col justify-between overflow-y-auto min-h-[100px] shrink-0 transition bg-[#111113]/30 ${hasDuty && hasAbsence ? "border-red-500/50 ring-2 ring-red-500/15" : "border-white/[0.05] hover:border-red-550/40 hover:bg-white/[0.02]"}`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span 
                        className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded border ${prontidao.text} flex items-center gap-1 shadow-sm`}
                        title={`Prontidão de Serviço Ativa: ${prontidao.name}`}
                      >
                        <span>{cell.dayNum}</span>
                        <span className="text-[7px] uppercase tracking-wide font-extrabold opacity-75">{prontidao.name}</span>
                      </span>
                    </div>

                    <div className="space-y-1 mt-1.5 flex-grow overflow-x-hidden">
                      {filteredEscalas.map(esc => {
                        const mil = activeBombeiros.find(b => b.id === esc.bombeiro_id);
                        return (
                          <div key={esc.id} className="text-[8.5px] leading-tight px-1.5 py-0.5 bg-red-600/10 border border-red-500/20 text-red-400 rounded-sm font-semibold whitespace-nowrap truncate" title={`${mil?.posto_grad} ${mil?.nome_guerra}: ${esc.funcao}`}>
                            ⚡ {mil?.nome_guerra} ({esc.periodo})
                          </div>
                        );
                      })}

                      {filteredFmos.map(fmo => {
                        const mil = activeBombeiros.find(b => b.id === fmo.bombeiro_id);
                        return (
                          <div key={fmo.id} className="text-[8.5px] leading-tight px-1.5 py-0.5 bg-purple-700/10 border border-purple-500/20 text-purple-400 rounded-sm font-semibold whitespace-nowrap truncate" title={`FMO Homologada: ${mil?.nome_guerra}`}>
                            💤 FMO {mil?.nome_guerra}
                          </div>
                        );
                      })}

                      {filteredAfastamentos.map(ab => {
                        const mil = activeBombeiros.find(b => b.id === ab.bombeiro_id);
                        return (
                          <div key={ab.id} className="text-[8.5px] leading-tight px-1.5 py-0.5 bg-amber-600/10 border border-amber-500/20 text-amber-500 rounded-sm font-semibold whitespace-nowrap truncate" title={`Afastado: ${mil?.nome_guerra} - MOTIVO: ${ab.tipo}`}>
                            🏥 {mil?.nome_guerra} ({ab.tipo})
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* RENDER VIEW 2: SP ENTERPRISE MATRIX DUTY BOARD */}
          {calendarViewMode === "matrix" && (
            <div className="overflow-x-auto border border-white/5 rounded-2xl bg-[#111113]/40 shadow-inner">
              <table className="w-full text-left text-xs border-collapse font-sans min-w-[1250px]">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10 uppercase tracking-wider text-[10px] font-extrabold text-slate-400">
                    <th className="py-4 px-4 sticky left-0 bg-[#161618] z-20 shadow-md min-w-[200px] border-r border-white/5">Militar da Guarnição</th>
                    {daysGrid.filter(d => d.dayNum !== null).map((dCell) => {
                      const pront = getProntidaoDoDiaStr(dCell.dateStr);
                      return (
                        <th key={dCell.dateStr} className="py-3 px-0.5 text-center w-[38px] border-r border-white/[0.02] bg-[#161618]">
                          <div 
                            className={`inline-flex flex-col items-center justify-center w-7 h-7 rounded-lg border font-mono text-[10px] font-black leading-tight ${pront.text}`}
                            title={`Equipe de Prontidão Ativa: de Serviço ${pront.name}`}
                          >
                            <span>{dCell.dayNum}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {activeBombeiros.length === 0 ? (
                    <tr>
                      <td colSpan={daysGrid.filter(d => d.dayNum !== null).length + 1} className="py-12 text-center text-slate-500 font-semibold block">
                        Nenhum militar cadastrado neste pelotão.
                      </td>
                    </tr>
                  ) : (
                    activeBombeiros.map((bombeiro) => (
                      <tr key={bombeiro.id} className="hover:bg-white/[0.01] transition">
                        {/* sticky name container */}
                        <td className="py-3 px-4 font-bold text-white sticky left-0 bg-[#161618] z-10 shadow-md border-r border-white/5">
                          <span className="text-[9px] text-slate-400 block leading-none font-medium mb-1">{bombeiro.posto_grad}</span>
                          <span className="text-xs text-slate-200 block truncate font-black leading-none">{bombeiro.nome_guerra}</span>
                          <span className="text-[8px] text-slate-500 font-mono leading-none block mt-1">RE {bombeiro.re}</span>
                        </td>

                        {/* Day Columns */}
                        {daysGrid.filter(d => d.dayNum !== null).map((dCell) => {
                          const dayEscala = stationEscalas.find(e => e.bombeiro_id === bombeiro.id && e.data === dCell.dateStr);
                          const dayFmo = stationFmos.find(f => f.bombeiro_id === bombeiro.id && f.data === dCell.dateStr);
                          const dayAfastamento = checkIfMilitarAfastadoOnDate(bombeiro.id, dCell.dateStr);

                          let cellBg = "bg-transparent border-white/[0.01] text-slate-600 hover:bg-white/[0.03] hover:border-white/10";
                          let cellText = "-";
                          let tooltip = `${bombeiro.nome_guerra} - Sem plantão cadastrado em ${dCell.dayNum}/${selectedMonth}`;

                          if (dayAfastamento) {
                            cellBg = "bg-amber-500/15 border-amber-500/25 text-amber-400 hover:bg-amber-500/25";
                            cellText = "AF";
                            tooltip = `Afastado (${dayAfastamento.tipo}) de ${dayAfastamento.data_inicio} até ${dayAfastamento.data_fim}: ${dayAfastamento.justificativa || "Sem obs."}`;
                          } else if (dayFmo) {
                            cellBg = "bg-purple-500/15 border-purple-500/25 text-purple-400 hover:bg-purple-550/25";
                            cellText = "FMO";
                            tooltip = `Folga Mensal Obrigatória (FMO) em ${dCell.dayNum}/${selectedMonth}`;
                          } else if (dayEscala) {
                            cellBg = "bg-red-500/15 border-red-500/25 text-red-500 hover:bg-red-500/25";
                            cellText = periodoAbrev(dayEscala.periodo);
                            tooltip = `Escalado no Plantão: ${dayEscala.funcao} (${dayEscala.periodo})`;
                          }

                          return (
                            <td 
                              key={dCell.dateStr} 
                              className="py-1 px-0.5 text-center border-r border-[#ffffff]/[0.02]"
                              title={tooltip}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setModalMilitarId(bombeiro.id);
                                  setModalAfFim(dCell.dateStr);
                                  setActiveCellModal({ bombeiroId: bombeiro.id, dateStr: dCell.dateStr });
                                }}
                                className={`w-10 h-7 mx-auto rounded-lg border font-mono text-[9px] font-black flex items-center justify-center cursor-pointer transition-all ${cellBg}`}
                              >
                                {cellText}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* POPUP MODAL: AGENDA DE SERVIÇO & AFASTAMENTOS */}
          {activeCellModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 no-print animate-fade-in backdrop-blur-xs">
              <div 
                className="bg-[#161618] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                
                {/* Header title */}
                <div className="flex justify-between items-start border-b border-white/5 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Painel Operacional do Dia</h3>
                    <div className="text-[11px] font-mono font-bold text-red-500 mt-0.5 animate-pulse">
                      📅 DATA: {formatDateBR(activeCellModal.dateStr, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setActiveCellModal(null);
                      setModalError(null);
                    }}
                    className="text-slate-400 hover:text-white px-2.5 py-1 font-bold text-xs bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition"
                  >
                    X
                  </button>
                </div>

                {/* Profile indicator */}
                {activeCellModal.bombeiroId !== "all" && (
                  <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex items-center gap-3">
                    <div className="bg-red-500/10 p-2 text-red-400 rounded-lg">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-500 block">Militar Selecionado</span>
                      <strong className="text-slate-200 text-xs">
                        {activeBombeiros.find(b => b.id === activeCellModal.bombeiroId)?.posto_grad} {activeBombeiros.find(b => b.id === activeCellModal.bombeiroId)?.nome_guerra}
                      </strong>
                      <span className="text-[9px] text-slate-400 font-mono block">RE: {activeBombeiros.find(b => b.id === activeCellModal.bombeiroId)?.re}</span>
                    </div>
                  </div>
                )}

                {/* Diagnóstico do Dia: render existing nodes */}
                <div className="space-y-2.5">
                  <span className="block text-[10px] uppercase font-black text-slate-400 tracking-wider">Situações e Lançamentos Existentes</span>
                  
                  {(() => {
                    const exactDate = activeCellModal.dateStr;
                    const bId = activeCellModal.bombeiroId;

                    // Filter existing items
                    const dayEscalas = stationEscalas.filter(e => e.data === exactDate && (bId === "all" || e.bombeiro_id === bId));
                    const dayFmos = stationFmos.filter(f => f.data === exactDate && (bId === "all" || f.bombeiro_id === bId));
                    const dayAfastamentos = stationAfastamentos.filter(ab =>
                      (ab.bombeiro_id === bId || bId === "all") &&
                      isDateKeyInRange(exactDate, ab.data_inicio, ab.data_fim)
                    );

                    const empty = dayEscalas.length === 0 && dayFmos.length === 0 && dayAfastamentos.length === 0;

                    if (empty) {
                      return <div className="text-center py-4 bg-white/[0.01] border border-dashed border-white/5 rounded-xl text-slate-500 text-xs italic">Nenhum serviço, FMO ou afastamento registrado para este militar nesta data.</div>;
                    }

                    return (
                      <div className="space-y-2">
                        {/* Escalas */}
                        {dayEscalas.map(esc => {
                          const mil = activeBombeiros.find(b => b.id === esc.bombeiro_id);
                          return (
                            <div key={esc.id} className="flex justify-between items-center bg-red-600/10 border border-red-500/20 p-2.5 rounded-xl text-xs">
                              <div>
                                <span className="block font-black text-[9px] text-red-400 uppercase tracking-wider">Plantão Ativo (⚡)</span>
                                <span className="text-slate-200 font-bold">{esc.funcao} ({esc.periodo})</span>
                                {bId === "all" && mil && <span className="block text-[10px] text-slate-400 mt-0.5">{mil.posto_grad} {mil.nome_guerra}</span>}
                              </div>
                              {isAdmin && onDeleteEscala && (
                                <button 
                                  onClick={() => handleModalDeleteEscala(esc.id)}
                                  className="px-2 py-1 text-[10px] bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-md cursor-pointer transition"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* FMOs */}
                        {dayFmos.map(fmo => {
                          const mil = activeBombeiros.find(b => b.id === fmo.bombeiro_id);
                          return (
                            <div key={fmo.id} className="flex justify-between items-center bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl text-xs">
                              <div>
                                <span className="block font-black text-[9px] text-purple-400 uppercase tracking-wider">Folga Mensal Obrigatória (💤)</span>
                                <span className="text-slate-200 font-bold">{fmo.justificativa || "Homologado corporativo"}</span>
                                {bId === "all" && mil && <span className="block text-[10px] text-slate-400 mt-0.5">{mil.posto_grad} {mil.nome_guerra}</span>}
                              </div>
                              {isAdmin && (
                                <button 
                                  onClick={() => handleModalDeleteFmo(fmo.id)}
                                  className="px-2 py-1 text-[10px] bg-red-650/40 hover:bg-red-600 text-red-100 font-extrabold rounded-md cursor-pointer transition"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Afastamentos */}
                        {dayAfastamentos.map(ab => {
                          const mil = activeBombeiros.find(b => b.id === ab.bombeiro_id);
                          return (
                            <div key={ab.id} className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-xs">
                              <div>
                                <span className="block font-black text-[9px] text-amber-500 uppercase tracking-wider">Afastamento Ativo (🏥)</span>
                                <span className="text-slate-100 font-black">{ab.tipo}</span>
                                <span className="block text-[10px] text-amber-400 font-mono mt-0.5 flex items-center gap-1">Pariodo: {ab.data_inicio} até {ab.data_fim}</span>
                                {ab.justificativa && <span className="block text-[9.5px] text-slate-400 italic">BG/Obs: {ab.justificativa}</span>}
                                {bId === "all" && mil && <span className="block text-[10px] text-slate-400 mt-0.5">{mil.posto_grad} {mil.nome_guerra}</span>}
                              </div>
                              {isAdmin && (
                                <button 
                                  onClick={() => handleModalDeleteAfastamento(ab.id)}
                                  className="px-2 py-1 text-[10px] bg-red-650/40 hover:bg-red-600 text-red-100 font-extrabold rounded-md cursor-pointer transition"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Registration form inside modal */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <span className="block text-[10px] uppercase font-black text-slate-400 tracking-wider">Registrar Novo Lançamento</span>
                  
                  {modalError && <div className="p-3 bg-red-600/10 border border-red-500/20 text-red-400 font-semibold rounded-xl text-xs">{modalError}</div>}

                  {isAdmin ? (
                    <form onSubmit={handleModalAdd} className="space-y-4 font-sans">
                    
                    {/* Firefighter selection dropdown if "all" was selected */}
                    {activeCellModal.bombeiroId === "all" && (
                      <div>
                        <label className="block text-[9px] uppercase font-black text-slate-400 mb-1.5">Militar Alvo</label>
                        <select
                          className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                          value={modalMilitarId}
                          onChange={(e) => setModalMilitarId(e.target.value)}
                          required
                        >
                          <option value="">-- Escolher Militar Pelotão --</option>
                          {activeBombeiros.map(b => (
                            <option key={b.id} value={b.id}>{b.nome_guerra} ({b.posto_grad})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Mode selection tabs */}
                    <div className="flex p-0.5 bg-[#111113] rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setModalSelection("escala")}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition ${modalSelection === "escala" ? "bg-red-600 text-white shadow-xs" : "text-slate-400 hover:text-white"}`}
                      >
                        Escala/Plantão
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalSelection("fmo")}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition ${modalSelection === "fmo" ? "bg-red-600 text-white shadow-xs" : "text-slate-400 hover:text-white"}`}
                      >
                        Folga FMO
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalSelection("afastamento")}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition ${modalSelection === "afastamento" ? "bg-red-600 text-white shadow-xs" : "text-slate-400 hover:text-white"}`}
                      >
                        Afastamento
                      </button>
                    </div>

                    {/* Mode form contents */}
                    {modalSelection === "escala" && (
                      <div className="space-y-3 animate-fade-in text-xs">
                        <div>
                          <label className="block text-[9.5px] uppercase font-black text-slate-400 mb-1">Posto de Guarnição</label>
                          <select
                            className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                            value={modalEscalaFuncao}
                            onChange={(e) => setModalEscalaFuncao(e.target.value)}
                          >
                            <option value="Chefe de Guarnição / Comandante do Posto">Chefe de Guarnição / Comandante do Posto</option>
                            <option value="Motorista de Emergência (ABS - Auto Bomba)">Motorista de Emergência (ABS - Auto Bomba)</option>
                            <option value="Motorista de Resgate (UR - Unidade de Resgate)">Motorista de Resgate (UR - Unidade de Resgate)</option>
                            <option value="Socorrista Resgatista (Auxiliar UR)">Socorrista Resgatista (Auxiliar UR)</option>
                            <option value="Auxiliar de Bomba & Linha de Combate">Auxiliar de Bomba & Linha de Combate</option>
                            <option value="Condutor da Escada Mecânica (AEM)">Condutor da Escada Mecânica (AEM)</option>
                            <option value="Telefonista / Despachante de Chamadas">Telefonista / Despachante de Chamadas</option>
                            <option value="Sentinela / Guarda de Portão">Sentinela / Guarda de Portão</option>
                            <option value="Auxiliar de Salvamento Terrestre">Auxiliar de Salvamento Terrestre</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[8.5px] uppercase font-black text-slate-400 mb-1.5">Turno de Expedição</label>
                          <div className="grid grid-cols-3 gap-2">
                            {PERIODOS_ESCALA.map((p) => (
                              <button
                                key={p}
                                type="button"
                                className={`py-1.5 rounded-lg text-xs font-bold border transition ${modalEscalaPeriodo === p ? "bg-red-655 bg-red-600 text-white border-red-600" : "bg-transparent text-slate-400 border-white/10 hover:bg-white/5"}`}
                                onClick={() => setModalEscalaPeriodo(p)}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {modalSelection === "fmo" && (
                      <div className="space-y-3 animate-fade-in text-xs">
                        <div>
                          <label className="block text-[9.5px] uppercase font-black text-slate-400 mb-1">Justificativa Operacional</label>
                          <input
                            type="text"
                            placeholder="Ex: Compensação de plantões extras de SGB..."
                            className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none"
                            value={modalFmoJustificativa}
                            onChange={(e) => setModalFmoJustificativa(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {modalSelection === "afastamento" && (
                      <div className="space-y-3 animate-fade-in text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] uppercase font-black text-slate-400 mb-1">Início do Termo</label>
                            <input
                              type="date"
                              className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white opacity-60 focus:outline-none"
                              value={activeCellModal.dateStr}
                              disabled
                            />
                            <span className="text-[9px] text-slate-550 mt-1 block">Inicia no dia da célula clicada</span>
                          </div>
                          <div>
                            <label className="block text-[9px] uppercase font-black text-slate-400 mb-1">Encerramento</label>
                            <input
                              type="date"
                              className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                              value={modalAfFim}
                              onChange={(e) => setModalAfFim(e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9.5px] uppercase font-black text-slate-400 mb-1">Amparo Legal / Tipologia</label>
                          <select
                            className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                            value={modalAfTipo}
                            onChange={(e) => setModalAfTipo(e.target.value)}
                          >
                            <option value="Férias">Férias regulamentares</option>
                            <option value="Licença Médica">Licença Médica / Tratamento Saúde</option>
                            <option value="Licença Prêmio">Licença Prêmio</option>
                            <option value="Gala (Núpcias)">Núpcias (Gala PMESP - 8 dias)</option>
                            <option value="Luto (Nojo)">Nojo (Falecimento Cônjuge/Família - 8 dias)</option>
                            <option value="Dispensa Escala">Dispensa de Serviço como Recompensa</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9.5px] uppercase font-black text-slate-400 mb-1">Súmula / BG / Obs</label>
                          <input
                            type="text"
                            placeholder="BG de amparo ou justificação adicional..."
                            className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none"
                            value={modalAfJustificativa}
                            onChange={(e) => setModalAfJustificativa(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 justify-end border-t border-white/5 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCellModal(null);
                          setModalError(null);
                        }}
                        className="py-2 px-4 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                        disabled={modalLoading}
                      >
                        Cancelar
                      </button>

                      <button
                        type="submit"
                        className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                        disabled={modalLoading}
                      >
                        {modalLoading ? "Processando..." : "Lançar Registro"}
                      </button>
                    </div>

                  </form>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-xs text-amber-400 font-semibold space-y-1">
                      <div className="flex items-center gap-2 text-amber-500">
                        <Shield className="w-4 h-4 shrink-0" />
                        <strong>Modo Consulta Reservado</strong>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-medium font-sans">Acesse uma conta de administrador homologada para marcar serviços, FMO ou cadastrar folhas de afastamento.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      )}


      {/* VISUALIZAÇÃO 3: FORMULÁRIOS DE LANÇAMENTOS */}
      {activeSubTab === "afastamentos" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
          
          {/* Section Left: Lançamento de Afastamentos */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-6 space-y-5">
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-md font-bold text-white flex items-center gap-2">
                <CalendarRange className="text-red-500 w-5 h-5" />
                Registrar Afastamento Temporário
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Lançamento oficial de Licenças, Férias regulamentares, núpcias (Casamento) ou luto no faturamento.
              </p>
            </div>

            {afFormError && <div className="p-3 bg-red-650 bg-red-600/10 border border-red-500/20 text-red-400 font-semibold rounded-xl text-xs">{afFormError}</div>}
            {afFormSuccess && <div className="p-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-semibold rounded-xl text-xs">Afastamento militar homologado com êxito!</div>}

            {isAdmin ? (
              <form onSubmit={handleCreateAfastamento} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Militar Beneficiário</label>
                  <select
                    className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                    value={afMilitarId}
                    onChange={(e) => setAfMilitarId(e.target.value)}
                    required
                  >
                    <option value="">-- Selecionar Militar --</option>
                    {activeBombeiros.map(b => (
                      <option key={b.id} value={b.id}>{b.nome_guerra} ({b.posto_grad})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Data de Início</label>
                    <input
                      type="date"
                      className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                      value={afInicio}
                      onChange={(e) => setAfInicio(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Data de Término</label>
                    <input
                      type="date"
                      className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                      value={afFim}
                      onChange={(e) => setAfFim(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Tipo de Afastamento / Amparo Legal</label>
                  <select
                    className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                    value={afTipo}
                    onChange={(e) => setAfTipo(e.target.value)}
                  >
                    <option value="Férias">Férias</option>
                    <option value="EAP">EAP (Estágio de Aperfeiçoamento Profissional / Instrução)</option>
                    <option value="Licença Médica">Licença Médica / Tratamento Saúde</option>
                    <option value="Licença Prêmio">Licença Prêmio</option>
                    <option value="Gala (Núpcias)">Núpcias (Gala PMESP - 8 dias)</option>
                    <option value="Luto (Nojo)">Nojo (Falecimento Cônjuge/Pais/Filhos - 8 dias)</option>
                    <option value="Dispensa Escala">Dispensa de Serviço como Recompensa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Súmula / BG / Justificativa</label>
                  <textarea
                    placeholder="BG de publicação ou justificativa detalhada..."
                    className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none h-20 resize-none"
                    value={afJustificativa}
                    onChange={(e) => setAfJustificativa(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#e11d48] hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> Cadastrar Termo de Afastamento
                </button>
              </form>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-xs text-amber-500 font-semibold space-y-1">
                <div className="flex items-center gap-2 text-amber-500">
                  <Shield className="w-4 h-4 shrink-0" />
                  <strong>Modo Consulta Ativado</strong>
                </div>
                <p className="text-[11px] text-zinc-400 font-medium">Faça login com uma conta de administrador homologada para planejar cadastros de afastamento temporário.</p>
              </div>
            )}

            {/* List Active leaves / afastados on SGB tenant */}
            <div className="pt-4 border-t border-white/5">
              <span className="block text-[10px] uppercase font-black text-slate-400 mb-2">Afastamentos Registrados</span>
              {stationAfastamentos.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">Nenhum militar afastado atualmente.</div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-[160px] pr-2">
                  {stationAfastamentos.map(ab => {
                    const mil = activeBombeiros.find(b => b.id === ab.bombeiro_id);
                    return (
                      <div key={ab.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-white block">{mil?.nome_guerra} ({ab.tipo})</strong>
                          <span className="text-slate-400 font-mono text-[10px] block mt-0.5">Período: {ab.data_inicio} até {ab.data_fim}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => onDeleteAfastamento(ab.id)}
                            className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg cursor-pointer transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>


          {/* Section Right: Lançamento de FMO (Folga Mensal Obrigatória) */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-6 space-y-5">
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-md font-bold text-white flex items-center gap-2">
                <CalendarIcon className="text-purple-500 w-5 h-5" />
                Marcar Folga Mensal Obrigatória (FMO)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Garante que os militares operacionais desfrutem das folgas para regular a jornada contratual e evitar sobrelabor involuntário.
              </p>
            </div>

            {fmoFormError && <div className="p-3 bg-red-650 bg-red-600/10 border border-red-500/20 text-red-400 font-semibold rounded-xl text-xs">{fmoFormError}</div>}
            {fmoFormSuccess && <div className="p-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-semibold rounded-xl text-xs">FMO adicionada e reservada com sucesso!</div>}

            {isAdmin ? (
              <form onSubmit={handleCreateFmo} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Bombeiro Associado</label>
                  <select
                    className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                    value={fmoMilitarId}
                    onChange={(e) => setFmoMilitarId(e.target.value)}
                    required
                  >
                    <option value="">-- Selecionar Militar --</option>
                    {activeBombeiros.filter(b => (b.regime || "PRONTIDÃO") !== "EXPEDIENTE").map(b => (
                      <option key={b.id} value={b.id}>{b.nome_guerra} ({b.posto_grad})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Data Desejada da FMO</label>
                  <input
                    type="date"
                    className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                    value={fmoData}
                    onChange={(e) => setFmoData(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Justificativa Operacional</label>
                  <input
                    type="text"
                    placeholder="Ex: Escala de folga de compensação de SGB"
                    className="w-full bg-[#111113] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none"
                    value={fmoJustificativa}
                    onChange={(e) => setFmoJustificativa(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition focus:ring-2 focus:ring-purple-500"
                >
                  <Plus className="w-4 h-4" /> Marcar Dia FMO
                </button>
              </form>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-xs text-amber-500 font-semibold space-y-1">
                <div className="flex items-center gap-2 text-amber-500">
                  <Shield className="w-4 h-4 shrink-0" />
                  <strong>Modo Consulta Ativado</strong>
                </div>
                <p className="text-[11px] text-zinc-400 font-medium">Faça login com uma conta de administrador homologada para marcar folgas obrigatórias FMO.</p>
              </div>
            )}

            {/* List custom fmos programmed for SGB */}
            <div className="pt-4 border-t border-white/5">
              <span className="block text-[10px] uppercase font-black text-slate-400 mb-2">FMOs Cadastradas neste Pelotão</span>
              {stationFmos.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">Nenhuma folga mensal obrigatória homologada.</div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-[160px] pr-2">
                  {stationFmos.map(f => {
                    const mil = activeBombeiros.find(b => b.id === f.bombeiro_id);
                    return (
                      <div key={f.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-white block">{mil?.nome_guerra} ({mil?.posto_grad})</strong>
                          <span className="text-slate-400 font-mono text-[10px] block mt-0.5">Data Reservada FMO: {f.data}</span>
                          {f.justificativa && <span className="text-slate-500 text-[10px] block mt-0.5 italic">Obs: {f.justificativa}</span>}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => onDeleteFmo(f.id)}
                            className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg cursor-pointer transition animate-in fade-in"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      )}


      {/* PRINT LAYOUT MASTER DEMONSTRATIVE REPORT */}
      <div className="hidden print:block font-sans text-xs bg-white text-slate-900 border border-black p-8 space-y-4">
        
        <div className="text-center space-y-1 pb-4 border-b border-black">
          <h2 className="text-xs font-bold tracking-wider">CORPO DE BOMBEIROS DO ESTADO DE SÃO PAULO</h2>
          <h3 className="text-xs font-bold uppercase">{activeQuartel?.nome.toUpperCase() || "UNIDADE MILITAR DE BOMBEIROS"}</h3>
          <h1 className="text-sm font-black uppercase">BOLETIM CONSOLIDADO DE PRESENÇAS E FREQUÊNCIA OPERACIONAL</h1>
          <p className="font-mono text-[9px] text-zinc-500">
            Referência de Período: {meses.find(m => m.value === selectedMonth)?.label} de {selectedYear} • SGB Control System
          </p>
        </div>

        <table className="w-full text-left text-[11px] border-collapse mt-4">
          <thead>
            <tr className="border-b-2 border-black bg-slate-100 font-extrabold text-slate-900 uppercase">
              <th className="p-2">Graduação / Militar / RE</th>
              <th className="p-2 text-center">Platões</th>
              <th className="p-2 text-center">FMO Cons.</th>
              <th className="p-2 text-center">Afastamentos</th>
              <th className="p-2 text-center">Hrs Trab</th>
            </tr>
          </thead>
          <tbody>
            {folhaFrequencia.map(item => (
              <tr key={item.bombeiro.id} className="border-b border-gray-300">
                <td className="p-2 font-bold">{item.bombeiro.posto_grad} {item.bombeiro.nome_guerra} ({item.bombeiro.re})</td>
                <td className="p-2 text-center font-bold font-mono">{item.plantoesContagem}</td>
                <td className="p-2 text-center font-bold font-mono">{item.fmosNoMes.length}</td>
                <td className="p-2 text-center font-mono">{item.diasAfastados}d</td>
                <td className="p-2 text-center font-mono">{item.horasTrabalhadas}h</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pt-4 border-t border-dashed border-gray-400 space-y-2">
          <span className="font-extrabold text-[10px] uppercase">Relação Operacional de Horários de Trabalho:</span>
          <p className="text-[10px] leading-relaxed text-zinc-700">
            Escalas calculadas com base nas presenças físicas e relatórios diários de prontidão homologados para o mês corrente. Deduções legais foram processadas com base nas licenças/férias indicadas na pasta pessoal.
          </p>
        </div>

        <div className="mt-14 pt-8 border-t border-black grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="h-10 border-b border-black"></div>
            <div className="font-bold uppercase mt-1">Sargento PM Auxiliar de Escala Súmula</div>
          </div>
          <div>
            <div className="h-10 border-b border-black"></div>
            <div className="font-bold uppercase mt-1">Capitão PM Comandante da Unidade de Bombeiros</div>
          </div>
        </div>

      </div>

    </div>
  );
}
