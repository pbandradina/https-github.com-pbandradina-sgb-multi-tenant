import { Afastamento, Fmo } from "../types";
import { buildDateKey, countDaysInRange, getDaysInMonth, isDateKeyInMonth, isDateKeyInRange } from "./dates";

/** Absence covering a given day for a firefighter, or null. */
export const findAfastamentoNaData = (
  afastamentos: Afastamento[],
  bombeiroId: string,
  dateKey: string
): Afastamento | null =>
  afastamentos.find(
    a => a.bombeiro_id === bombeiroId && isDateKeyInRange(dateKey, a.data_inicio, a.data_fim)
  ) || null;

/** Mandatory day off (FMO) booked for a given day, or null. */
export const findFmoNaData = (fmos: Fmo[], bombeiroId: string, dateKey: string): Fmo | null =>
  fmos.find(f => f.bombeiro_id === bombeiroId && f.data === dateKey) || null;

export const filterFmosDoMes = (fmos: Fmo[], bombeiroId: string, month: number, year: number): Fmo[] =>
  fmos.filter(f => f.bombeiro_id === bombeiroId && isDateKeyInMonth(f.data, month, year));

/** Absences of a firefighter overlapping the given month. */
export const filterAfastamentosDoMes = (
  afastamentos: Afastamento[],
  bombeiroId: string,
  month: number,
  year: number
): Afastamento[] => {
  const monthStart = buildDateKey(year, month, 1);
  const monthEnd = buildDateKey(year, month, getDaysInMonth(month, year));
  return afastamentos.filter(
    a => a.bombeiro_id === bombeiroId && a.data_inicio <= monthEnd && a.data_fim >= monthStart
  );
};

export const contarDiasAfastados = (afastamentos: Afastamento[]): number =>
  afastamentos.reduce((total, a) => total + countDaysInRange(a.data_inicio, a.data_fim), 0);
