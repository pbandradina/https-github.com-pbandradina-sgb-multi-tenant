import { Afastamento, Bombeiro, Escala, Fmo } from "../types";
import { countDaysInclusive, isDateInMonth, overlapsMonth, parseDateString } from "./dates";

// Standard monthly duty limit above which hours are considered surplus.
export const LIMITE_HORAS_MES = 160;

export interface HorasPeriodo {
  horas: number;
  noturnas: number;
}

export function getHorasPeriodo(periodo: string): HorasPeriodo {
  if (periodo === "24h") return { horas: 24, noturnas: 7 };
  if (periodo === "Noturno 12h") return { horas: 12, noturnas: 7 };
  return { horas: 12, noturnas: 0 };
}

export function findAfastamentoOnDate(
  afastamentos: Afastamento[],
  militarId: string,
  dateStr: string
): Afastamento | null {
  const targetDate = parseDateString(dateStr);
  for (const afastamento of afastamentos) {
    if (afastamento.bombeiro_id !== militarId) continue;
    const start = parseDateString(afastamento.data_inicio);
    const end = parseDateString(afastamento.data_fim);
    if (targetDate >= start && targetDate <= end) {
      return afastamento;
    }
  }
  return null;
}

export function findFmoOnDate(fmos: Fmo[], militarId: string, dateStr: string): Fmo | undefined {
  return fmos.find(fmo => fmo.bombeiro_id === militarId && fmo.data === dateStr);
}

export interface ConflitoEscala {
  militar: string;
  data: string;
  descricao: string;
  tipo: "afastamento" | "fmo";
}

export function detectConflitosEscala(
  escalas: Escala[],
  bombeiros: Bombeiro[],
  afastamentos: Afastamento[],
  fmos: Fmo[]
): ConflitoEscala[] {
  const conflitos: ConflitoEscala[] = [];

  escalas.forEach(escala => {
    const militar = bombeiros.find(b => b.id === escala.bombeiro_id);
    if (!militar) return;

    const afastamento = findAfastamentoOnDate(afastamentos, militar.id, escala.data);
    if (afastamento) {
      conflitos.push({
        militar: militar.nome_guerra,
        data: escala.data,
        descricao: `Escalado no período de ${afastamento.tipo} G.B. (${afastamento.data_inicio} a ${afastamento.data_fim})`,
        tipo: "afastamento"
      });
    }

    if (findFmoOnDate(fmos, militar.id, escala.data)) {
      conflitos.push({
        militar: militar.nome_guerra,
        data: escala.data,
        descricao: "Plantonista escalado em data reservada como FMO (Folga Obrigatória)",
        tipo: "fmo"
      });
    }
  });

  return conflitos;
}

export interface FrequenciaItem {
  bombeiro: Bombeiro;
  plantoesMes: Escala[];
  plantoesContagem: number;
  horasTrabalhadas: number;
  horasNoturnas: number;
  horasExcedentes: number;
  afastamentosNoMes: Afastamento[];
  fmosNoMes: Fmo[];
  diasAfastados: number;
}

export function computeFrequenciaMilitar(
  bombeiro: Bombeiro,
  escalas: Escala[],
  afastamentos: Afastamento[],
  fmos: Fmo[],
  month: number,
  year: number
): FrequenciaItem {
  const plantoesMes = escalas.filter(
    escala => escala.bombeiro_id === bombeiro.id && isDateInMonth(escala.data, month, year)
  );

  const afastamentosNoMes = afastamentos.filter(
    afastamento =>
      afastamento.bombeiro_id === bombeiro.id &&
      overlapsMonth(afastamento.data_inicio, afastamento.data_fim, month, year)
  );

  const fmosNoMes = fmos.filter(fmo => fmo.bombeiro_id === bombeiro.id && isDateInMonth(fmo.data, month, year));

  let horasTrabalhadas = 0;
  let horasNoturnas = 0;
  let plantoesContagem = 0;

  plantoesMes.forEach(plantao => {
    // A shift served while on leave does not count towards attendance.
    if (findAfastamentoOnDate(afastamentos, bombeiro.id, plantao.data)) return;

    plantoesContagem++;
    const { horas, noturnas } = getHorasPeriodo(plantao.periodo);
    horasTrabalhadas += horas;
    horasNoturnas += noturnas;
  });

  const diasAfastados = afastamentosNoMes.reduce(
    (acc, afastamento) => acc + countDaysInclusive(afastamento.data_inicio, afastamento.data_fim),
    0
  );

  return {
    bombeiro,
    plantoesMes,
    plantoesContagem,
    horasTrabalhadas,
    horasNoturnas,
    horasExcedentes: Math.max(0, horasTrabalhadas - LIMITE_HORAS_MES),
    afastamentosNoMes,
    fmosNoMes,
    diasAfastados
  };
}

export function matchesBombeiroSearch(bombeiro: Bombeiro, searchTerm: string): boolean {
  const term = searchTerm.toLowerCase();
  return (
    bombeiro.nome.toLowerCase().includes(term) ||
    bombeiro.nome_guerra.toLowerCase().includes(term) ||
    bombeiro.re.toLowerCase().includes(term) ||
    bombeiro.posto_grad.toLowerCase().includes(term)
  );
}

export function isRegimeProntidao(bombeiro: Bombeiro): boolean {
  return (bombeiro.regime || "PRONTIDÃO") !== "EXPEDIENTE";
}

export function computeFolhaFrequencia(
  bombeiros: Bombeiro[],
  escalas: Escala[],
  afastamentos: Afastamento[],
  fmos: Fmo[],
  month: number,
  year: number,
  searchTerm = ""
): FrequenciaItem[] {
  return bombeiros
    .filter(isRegimeProntidao)
    .map(bombeiro => computeFrequenciaMilitar(bombeiro, escalas, afastamentos, fmos, month, year))
    .filter(item => matchesBombeiroSearch(item.bombeiro, searchTerm));
}

export interface TotaisFrequencia {
  totalHorasGeraisDedicadas: number;
  totalHorasNoturnasGerais: number;
  totalHorasExcedentesGerais: number;
  totalPlantoesGerais: number;
  totalFmosGerais: number;
  totalDiasAfastadosGerais: number;
}

export function computeTotaisFrequencia(folha: FrequenciaItem[]): TotaisFrequencia {
  return folha.reduce<TotaisFrequencia>(
    (totais, item) => ({
      totalHorasGeraisDedicadas: totais.totalHorasGeraisDedicadas + item.horasTrabalhadas,
      totalHorasNoturnasGerais: totais.totalHorasNoturnasGerais + item.horasNoturnas,
      totalHorasExcedentesGerais: totais.totalHorasExcedentesGerais + item.horasExcedentes,
      totalPlantoesGerais: totais.totalPlantoesGerais + item.plantoesContagem,
      totalFmosGerais: totais.totalFmosGerais + item.fmosNoMes.length,
      totalDiasAfastadosGerais: totais.totalDiasAfastadosGerais + item.diasAfastados
    }),
    {
      totalHorasGeraisDedicadas: 0,
      totalHorasNoturnasGerais: 0,
      totalHorasExcedentesGerais: 0,
      totalPlantoesGerais: 0,
      totalFmosGerais: 0,
      totalDiasAfastadosGerais: 0
    }
  );
}
