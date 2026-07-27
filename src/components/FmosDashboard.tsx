import React, { useState, useMemo } from "react";
import { 
  Users, Award, Search, Calendar, CheckCircle2, AlertTriangle, 
  Clock, RefreshCw, BarChart2, ShieldCheck, HelpCircle
} from "lucide-react";
import { Bombeiro, Afastamento, Fmo } from "../types";
import { describeError } from "../api";

interface FmosDashboardProps {
  selectedQuartelId: string;
  bombeiros: Bombeiro[];
  afastamentos: Afastamento[];
  fmos: Fmo[];
  onAddFmo?: (data: Omit<Fmo, "id">) => Promise<void>;
  onDeleteFmo?: (id: string) => Promise<void>;
  isAdmin?: boolean;
}

// Color reference function matching current system calendar cadence
function getProntidaoDoDia(date: Date): "VERDE" | "AMARELA" | "AZUL" {
  const reference = new Date(2026, 0, 1).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((target - reference) / (1000 * 60 * 60 * 24));
  const idx = ((diffDays % 3) + 3) % 3;
  const choices = ["VERDE", "AMARELA", "AZUL"] as const;
  return choices[idx];
}

// Helper to format ranges nicely
function formatRangeStr(startStr: string, endStr: string): string {
  const monthsBr = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const dStart = new Date(startStr + "T12:00:00");
  const dEnd = new Date(endStr + "T12:00:00");
  const startDay = String(dStart.getDate()).padStart(2, "0");
  const startMonth = monthsBr[dStart.getMonth()];
  const endDay = String(dEnd.getDate()).padStart(2, "0");
  const endMonth = monthsBr[dEnd.getMonth()];
  return `${startDay}${startMonth} a ${endDay}${endMonth}`;
}

export function calculateFmoStatus(
  bombeiro: Bombeiro,
  allAfastamentos: Afastamento[],
  allFmos: Fmo[]
) {
  const equipe = bombeiro.equipe || "VERDE";
  if ((bombeiro.regime || "PRONTIDÃO") !== "PRONTIDÃO") {
    return {
      conquistadas: 0,
      usadas: 0,
      disponivel: 0,
      progress: 0,
      concessaoRange: "",
      previsaoConclusao: "regime expediente",
      ciclos: [],
      error: true
    };
  }

  // Filter to current firefighter
  const bAfastamentos = allAfastamentos.filter(a => a.bombeiro_id === bombeiro.id);
  const bFmos = allFmos.filter(f => f.bombeiro_id === bombeiro.id);

  // Timebound simulation: from 2026-01-01 to 2026-12-31 day by day
  const start = new Date("2026-01-01T12:00:00");
  const end = new Date("2026-12-31T12:00:00");

  let currentProgress = 0;
  let conquistadas = 0;
  let cycles: Array<{ inicio: string; fim: string }> = [];
  
  let cycleStartDayStr: string | null = null;
  let isReset = false;

  // Faster lookup index of dates
  const afMap = new Map<string, string>(); // yyyy-mm-dd -> type
  bAfastamentos.forEach(af => {
    const s = new Date(af.data_inicio + "T12:00:00");
    const e = new Date(af.data_fim + "T12:00:00");
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      afMap.set(`${yyyy}-${mm}-${dd}`, af.tipo);
    }
  });

  const fmoSet = new Set<string>();
  bFmos.forEach(f => fmoSet.add(f.data));

  const msInDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((end.getTime() - start.getTime()) / msInDay) + 1;

  for (let i = 0; i < totalDays; i++) {
    const curDate = new Date(start.getTime() + i * msInDay);
    const yyyy = curDate.getFullYear();
    const mm = String(curDate.getMonth() + 1).padStart(2, "0");
    const dd = String(curDate.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // On-duty day according to the firefighters team color rotation
    if (getProntidaoDoDia(curDate) === equipe) {
      const afTipo = afMap.get(dateStr);
      const isFmoTaken = fmoSet.has(dateStr);

      if (afTipo) {
        // Redirection states: Férias and Licença Prêmio resets the cycle.
        const isResetAbsence = afTipo === "Férias" || afTipo === "Licença Prêmio";
        if (isResetAbsence) {
          currentProgress = 0;
          cycleStartDayStr = null;
          isReset = true;
        } else {
          // Other leaves (EAP, Licença Médica, Gala, Nojo, Dispensa) just pause/interrupt
          // nothing to do, progress is maintained but we don't count today
        }
      } else if (isFmoTaken) {
        // High-level FMO day taken does not count as a service day.
      } else {
        // Standard duty shift worked!
        isReset = false;
        if (currentProgress === 0) {
          cycleStartDayStr = dateStr;
        }
        currentProgress += 1;

        if (currentProgress === 9) {
          conquistadas += 1;
          cycles.push({
            inicio: cycleStartDayStr || dateStr,
            fim: dateStr
          });
          currentProgress = 0;
          cycleStartDayStr = null;
        }
      }
    }
  }

  const usadas = bFmos.length;
  const disponivel = Math.max(0, conquistadas - usadas);

  let concessaoRange = "";
  if (cycles.length > 0) {
    const lastCycle = cycles[cycles.length - 1];
    concessaoRange = formatRangeStr(lastCycle.inicio, lastCycle.fim);
  }

  // Predict future shift date for completing the current 9-shift cycle
  let previsaoConclusao = "ciclo zerado";
  if (isReset) {
    previsaoConclusao = "ciclo zerado";
  } else {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    
    let tempProgress = currentProgress;
    let found = false;
    
    for (let dForward = 0; dForward < 200; dForward++) {
      const checkDate = new Date(today.getTime() + dForward * msInDay);
      const yStr = checkDate.getFullYear();
      const mStr = String(checkDate.getMonth() + 1).padStart(2, "0");
      const dStr = String(checkDate.getDate()).padStart(2, "0");
      const checkDateStr = `${yStr}-${mStr}-${dStr}`;

      if (getProntidaoDoDia(checkDate) === equipe) {
        const afTipo = afMap.get(checkDateStr);
        const isFmo = fmoSet.has(checkDateStr);

        if (afTipo) {
          if (afTipo === "Férias" || afTipo === "Licença Prêmio") {
            tempProgress = 0;
            break; 
          }
        } else if (isFmo) {
          // paused, skip
        } else {
          tempProgress += 1;
          if (tempProgress === 9) {
            previsaoConclusao = `${dStr}/${mStr}/${yStr}`;
            found = true;
            break;
          }
        }
      }
    }
    if (!found) {
      if (tempProgress === 0) {
        previsaoConclusao = "ciclo zerado";
      } else {
        previsaoConclusao = "--";
      }
    }
  }

  return {
    conquistadas,
    usadas,
    disponivel,
    progress: currentProgress,
    concessaoRange,
    previsaoConclusao,
    ciclos: cycles,
    error: false
  };
}

export default function FmosDashboard({
  selectedQuartelId,
  bombeiros,
  afastamentos,
  fmos,
  onAddFmo,
  onDeleteFmo,
  isAdmin = false
}: FmosDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("TODAS");
  const [showFmoHelper, setShowFmoHelper] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Active platoon state
  const activeBombeiros = useMemo(() => {
    return bombeiros.filter(b => b.quartel_id === selectedQuartelId && (b.regime || "").toUpperCase() === "PRONTIDÃO");
  }, [bombeiros, selectedQuartelId]);

  // Compute stats for each filtered firefighter
  const calculatedData = useMemo(() => {
    return activeBombeiros.map(b => {
      const stats = calculateFmoStatus(b, afastamentos, fmos);
      return {
        bombeiro: b,
        ...stats
      };
    });
  }, [activeBombeiros, afastamentos, fmos]);

  // Apply filters
  const filteredData = useMemo(() => {
    return calculatedData.filter(item => {
      const nameMatch = 
        item.bombeiro.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.bombeiro.nome_guerra.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.bombeiro.re && item.bombeiro.re.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const teamMatch = teamFilter === "TODAS" || item.bombeiro.equipe === teamFilter;
      
      return nameMatch && teamMatch;
    });
  }, [calculatedData, searchTerm, teamFilter]);

  // Handle deletions
  const handleDelete = async (id: string) => {
    if (!isAdmin || !onDeleteFmo || !confirm("Tem certeza que deseja remover este registro de folga?")) return;
    setDeleteError(null);
    try {
      await onDeleteFmo(id);
    } catch (err) {
      console.error("Erro ao remover registro de FMO:", err);
      setDeleteError(`Erro ao remover registro de folga: ${describeError(err)}`);
    }
  };

  // Top overall stats
  const totalConquistadas = useMemo(() => calculatedData.reduce((acc, c) => acc + c.conquistadas, 0), [calculatedData]);
  const totalUsadas = useMemo(() => calculatedData.reduce((acc, c) => acc + c.usadas, 0), [calculatedData]);
  const totalDisponivel = useMemo(() => calculatedData.reduce((acc, c) => acc + c.disponivel, 0), [calculatedData]);

  // Count positive balance (disponível > 0)
  const saldoPositivoCount = useMemo(() => calculatedData.filter(c => c.disponivel > 0).length, [calculatedData]);
  const saldoZeradoCount = useMemo(() => calculatedData.filter(c => c.disponivel === 0).length, [calculatedData]);

  const teamBadges: Record<string, string> = {
    VERDE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    AMARELA: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    AZUL: "bg-blue-500/10 text-blue-400 border-blue-500/20"
  };

  return (
    <div className="space-y-6">

      {deleteError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold px-3 py-2 rounded-xl">
          {deleteError}
        </div>
      )}

      {/* Header and Live stats indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Award className="w-7 h-7 text-red-500" />
            Dashboard de Folgas Obrigatórias (FMO)
          </h1>
          <p className="text-xs text-slate-400">
            Acompanhamento em tempo real dos ciclos de plantão (Ciclo PMESP SP/CB de 9 serviços para aquisição de folga).
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowFmoHelper(!showFmoHelper)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-850 cursor-pointer transition"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Regramento Operacional</span>
          </button>
          <div className="font-mono text-[10px] text-slate-500 bg-white/[0.02] border border-white/5 py-2 px-3 rounded-xl">
            Sincronizado: {new Date().toLocaleDateString("pt-BR")}
          </div>
        </div>
      </div>

      {/* Rules Explainer Alertbox */}
      {showFmoHelper && (
        <div className="bg-[#121214] border border-white-5 border-l-4 border-l-red-500 p-5 rounded-2xl space-y-3 text-xs text-slate-300 animate-slide-in">
          <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-red-500" />
            Entenda o cálculo operacional de concessão da FMO:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ul className="list-disc pl-4 space-y-1 text-slate-450">
              <li><strong>Ciclo e Serviços:</strong> Cada 9 (nove) serviços de prontidão realizados de acordo com a rotação de cores constitui 1 crédito de Folga Mensal Obrigatória.</li>
              <li><strong>Modificadores de Ciclo:</strong> O período de concessão é compreendido entre a primeira e a última escala da sequência.</li>
              <li><strong>Impactos de Afastamentos:</strong>
                <ul className="list-circle pl-4 mt-1 space-y-1">
                  <li><span className="text-purple-400 font-bold">Interrompe (Pausa):</span> EAP (Curso/Estágio), Licenças Médicas, Gala (Núpcias), Nojo (Luto) ou dispensas temporárias. Não perdem o saldo; o dia é apenas pulado.</li>
                  <li><span className="text-red-400 font-bold">Zera o ciclo:</span> Início de Férias regulamentares ou Licença Prêmio. O ciclo é interrompido e zerado imediatamente.</li>
                </ul>
              </li>
            </ul>
            <div className="bg-black/20 p-3 rounded-xl border border-white/[0.02] space-y-2">
              <span className="block font-bold text-slate-200">Exemplo Prático (Simulação Maquete):</span>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Se o bombeiro possui equipe <span className="text-emerald-400 font-extrabold">VERDE</span> e iniciou o serviço em 01/Maio, suas prontidões seriam nos dias 01, 04, 07, 10, 13, 16, 19, 22, 25. Em 25/Maio ele fecha o ciclo e ganha o crédito de FMO. 
                Se houve afastamento por <span className="text-purple-400 font-bold">EAP</span> em 19/Maio, a prontidão de 19/Maio foi pulada, estendendo o fechamento do ciclo para o dia 28/Maio (período de concessão: 01/mai a 28/mai).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Indicators Widgets Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* Folgas Conquistadas */}
        <div className="bg-[#161618] p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider block">Folgas Conquistadas</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-white">{totalConquistadas}</span>
            <span className="text-xs text-slate-500 font-medium">unidades</span>
          </div>
        </div>

        {/* Folgas Usadas */}
        <div className="bg-[#161618] p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider block">Folgas Utilizadas</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-white">{totalUsadas}</span>
            <span className="text-xs text-slate-500 font-medium">unidades</span>
          </div>
        </div>

        {/* Créditos Disponíveis */}
        <div className="bg-[#161618] p-5 rounded-2xl border border-white/5 flex flex-col justify-between ring-1 ring-red-500/20">
          <span className="text-[10px] text-blue-400 font-black uppercase tracking-wider block">Créditos Disponíveis</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-red-500">{totalDisponivel}</span>
            <span className="text-xs text-slate-500 font-medium">disponíveis</span>
          </div>
        </div>

        {/* Saldo Ativo (Disponível > 0) */}
        <div className="bg-[#161618] p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Militares c/ Crédito</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-emerald-500">{saldoPositivoCount}</span>
            <span className="text-xs text-slate-500 font-medium">bombeiros</span>
          </div>
        </div>

        {/* Saldo Zerado (Disponível = 0) */}
        <div className="bg-[#161618] p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Militares Zerados</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-400">{saldoZeradoCount}</span>
            <span className="text-xs text-slate-500 font-medium">bombeiros</span>
          </div>
        </div>

      </div>

      {/* Filter Options and Search panel */}
      <div className="bg-[#111113] p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row gap-3">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar bombeiro por nome, RE..."
            className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Team category dropdown filter */}
        <div className="flex gap-2 min-w-[200px]">
          <select
            className="w-full bg-[#161618] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="TODAS">Prevenir por Equipe: Todas</option>
            <option value="VERDE">Equipe VERDE (Prontidão)</option>
            <option value="AMARELA">Equipe AMARELA (Prontidão)</option>
            <option value="AZUL">Equipe AZUL (Prontidão)</option>
          </select>
        </div>

      </div>

      {/* Cards list grid representing the exact uploaded mockup layout */}
      {filteredData.length === 0 ? (
        <div className="bg-[#111113] p-12 rounded-3xl border border-dashed border-white/5 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="font-bold text-white text-sm mb-1">Nenhum bombeiro da prontidão encontrado</h3>
          <p className="text-xs text-slate-500">Tente ajustar a busca ou filtre em outra equipe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredData.map(({ bombeiro, conquistadas, usadas, disponivel, progress, concessaoRange, previsaoConclusao }) => {
            const teamBadgeClass = teamBadges[bombeiro.equipe || "VERDE"] || "bg-slate-500/10 text-slate-400 border-slate-500/0";
            const teamLetter = (bombeiro.equipe || "VERDE").slice(0, 2).toUpperCase();

            return (
              <div 
                key={bombeiro.id} 
                className="bg-[#111113] border border-white/5 rounded-2xl p-5 hover:border-white/10 hover:bg-[#131316] transition flex flex-col justify-between"
              >
                <div>
                  
                  {/* Top line info */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-black text-white text-sm tracking-tight">{bombeiro.nome_guerra}</h4>
                      <p className="text-[11px] text-slate-400 font-bold leading-none mt-1">{bombeiro.posto_grad || "Soldado"}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 text-[9px] font-black border rounded-md tracking-wider ${teamBadgeClass}`}>
                        {teamLetter}
                      </span>
                      {disponivel > 0 ? (
                        <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold bg-[#e53e3e]/10 text-red-400 border border-red-500/10 rounded-md">
                          +{disponivel}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold bg-white/5 text-slate-400 border border-white/5 rounded-md">
                          0
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operational stats items */}
                  <div className="space-y-2 mb-4">
                    
                    {/* Conquistadas rows with dark input box styling */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/15 border border-white/[0.02]/20">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-[10.5px] text-slate-350 font-semibold">Conquistadas</span>
                      </div>
                      <span className="text-xs font-mono font-black text-white bg-slate-900/80 px-2.5 py-0.5 rounded-lg border border-white/5">
                        {conquistadas}
                      </span>
                    </div>

                    {/* Usadas rows */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/15 border border-white/[0.02]/20">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-[10.5px] text-slate-350 font-semibold">Usadas</span>
                      </div>
                      <span className="text-xs font-mono font-black text-white bg-slate-900/80 px-2.5 py-0.5 rounded-lg border border-white/5">
                        {usadas}
                      </span>
                    </div>

                    {/* Disponível with concession period displayed */}
                    <div className={`flex flex-col gap-1 px-3.5 py-2.5 rounded-xl bg-black/15 border ${disponivel > 0 ? "border-red-500/25" : "border-white/[0.02]/20"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${disponivel > 0 ? "bg-red-500 animate-pulse" : "bg-slate-400"}`}></span>
                          <span className="text-[10.5px] text-slate-350 font-semibold">Disponível</span>
                        </div>
                        <span className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-lg border ${disponivel > 0 ? "bg-red-600 text-white border-red-500" : "bg-slate-900/80 text-white border-white/5"}`}>
                          {disponivel}
                        </span>
                      </div>
                      {concessaoRange && disponivel > 0 && (
                        <span className="text-[9.5px] text-red-400 text-right font-mono font-bold leading-none mt-1 uppercase">
                          ({concessaoRange})
                        </span>
                      )}
                    </div>

                  </div>

                </div>

                {/* Progress parameters and bar */}
                <div className="border-t border-white/5 pt-4 space-y-2 mt-2">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400 font-bold">Progresso do Ciclo</span>
                    <span className="font-mono text-white font-extrabold">{progress}/9</span>
                  </div>
                  
                  {/* Visual colored progress bar */}
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-white/5">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${bombeiro.equipe === "VERDE" ? "bg-emerald-500" : bombeiro.equipe === "AMARELA" ? "bg-amber-400" : "bg-blue-500"}`}
                      style={{ width: `${Math.round((progress / 9) * 100)}%` }}
                    />
                  </div>

                  {/* Previsão de Conclusão */}
                  <div className="flex items-center justify-between text-[10.5px] pt-1 uppercase">
                    <span className="text-slate-500 font-bold">Previsão conclusão</span>
                    <span className={`font-mono font-black text-[10px] ${previsaoConclusao === "ciclo zerado" ? "text-slate-500 italic" : "text-red-400"}`}>
                      {previsaoConclusao}
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
