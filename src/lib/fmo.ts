import { Afastamento, Bombeiro, Fmo } from "../types";
import { MS_IN_DAY, formatRangeStr, parseDateString, toDateString } from "./dates";
import { getProntidaoDoDia } from "./prontidao";

// Duty shifts a firefighter must serve to earn one FMO (Folga Mensal Obrigatória).
export const PLANTOES_POR_CICLO_FMO = 9;

// Leaves that zero the running cycle instead of merely pausing it.
export const AFASTAMENTOS_QUE_ZERAM_CICLO = ["Férias", "Licença Prêmio"];

export const CICLO_INICIO = "2026-01-01";
export const CICLO_FIM = "2026-12-31";

export interface CicloFmo {
  inicio: string;
  fim: string;
}

export interface FmoStatus {
  conquistadas: number;
  usadas: number;
  disponivel: number;
  progress: number;
  concessaoRange: string;
  previsaoConclusao: string;
  ciclos: CicloFmo[];
  error: boolean;
}

function buildAfastamentoMap(afastamentos: Afastamento[]): Map<string, string> {
  const afMap = new Map<string, string>();
  afastamentos.forEach(afastamento => {
    const start = parseDateString(afastamento.data_inicio, "T12:00:00");
    const end = parseDateString(afastamento.data_fim, "T12:00:00");
    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      afMap.set(toDateString(date), afastamento.tipo);
    }
  });
  return afMap;
}

export function calculateFmoStatus(
  bombeiro: Bombeiro,
  allAfastamentos: Afastamento[],
  allFmos: Fmo[],
  today: Date = new Date()
): FmoStatus {
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

  const bAfastamentos = allAfastamentos.filter(a => a.bombeiro_id === bombeiro.id);
  const bFmos = allFmos.filter(f => f.bombeiro_id === bombeiro.id);

  const start = parseDateString(CICLO_INICIO, "T12:00:00");
  const end = parseDateString(CICLO_FIM, "T12:00:00");

  let currentProgress = 0;
  let conquistadas = 0;
  const cycles: CicloFmo[] = [];

  let cycleStartDayStr: string | null = null;
  let isReset = false;

  const afMap = buildAfastamentoMap(bAfastamentos);
  const fmoSet = new Set<string>(bFmos.map(f => f.data));

  const totalDays = Math.round((end.getTime() - start.getTime()) / MS_IN_DAY) + 1;

  for (let i = 0; i < totalDays; i++) {
    const curDate = new Date(start.getTime() + i * MS_IN_DAY);
    const dateStr = toDateString(curDate);

    // On-duty day according to the firefighter's team color rotation
    if (getProntidaoDoDia(curDate) !== equipe) continue;

    const afTipo = afMap.get(dateStr);
    if (afTipo) {
      // Férias and Licença Prêmio reset the cycle; other leaves just pause it.
      if (AFASTAMENTOS_QUE_ZERAM_CICLO.includes(afTipo)) {
        currentProgress = 0;
        cycleStartDayStr = null;
        isReset = true;
      }
    } else if (fmoSet.has(dateStr)) {
      // An FMO day taken does not count as a service day.
    } else {
      isReset = false;
      if (currentProgress === 0) {
        cycleStartDayStr = dateStr;
      }
      currentProgress += 1;

      if (currentProgress === PLANTOES_POR_CICLO_FMO) {
        conquistadas += 1;
        cycles.push({ inicio: cycleStartDayStr || dateStr, fim: dateStr });
        currentProgress = 0;
        cycleStartDayStr = null;
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

  return {
    conquistadas,
    usadas,
    disponivel,
    progress: currentProgress,
    concessaoRange,
    previsaoConclusao: isReset
      ? "ciclo zerado"
      : predictConclusaoCiclo(equipe, currentProgress, afMap, fmoSet, today),
    ciclos: cycles,
    error: false
  };
}

// Projects the date on which the running 9-shift cycle completes, scanning forward
// from `today` for at most 200 days.
function predictConclusaoCiclo(
  equipe: string,
  currentProgress: number,
  afMap: Map<string, string>,
  fmoSet: Set<string>,
  today: Date
): string {
  const reference = new Date(today);
  reference.setHours(12, 0, 0, 0);

  let tempProgress = currentProgress;

  for (let dForward = 0; dForward < 200; dForward++) {
    const checkDate = new Date(reference.getTime() + dForward * MS_IN_DAY);
    if (getProntidaoDoDia(checkDate) !== equipe) continue;

    const checkDateStr = toDateString(checkDate);
    const afTipo = afMap.get(checkDateStr);

    if (afTipo) {
      if (AFASTAMENTOS_QUE_ZERAM_CICLO.includes(afTipo)) {
        return "ciclo zerado";
      }
    } else if (fmoSet.has(checkDateStr)) {
      // paused, skip
    } else {
      tempProgress += 1;
      if (tempProgress === PLANTOES_POR_CICLO_FMO) {
        const [year, month, day] = checkDateStr.split("-");
        return `${day}/${month}/${year}`;
      }
    }
  }

  return tempProgress === 0 ? "ciclo zerado" : "--";
}
