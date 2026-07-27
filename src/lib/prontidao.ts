import { parseDateString } from "./dates";

export type EquipeProntidao = "VERDE" | "AMARELA" | "AZUL";

export const EQUIPES_PRONTIDAO: EquipeProntidao[] = ["VERDE", "AMARELA", "AZUL"];

// First day of the 3-team rotation cadence currently in force.
export const PRONTIDAO_REFERENCE_DATE = new Date(2026, 0, 1);

export function getProntidaoIndex(date: Date): number {
  const reference = PRONTIDAO_REFERENCE_DATE.getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((target - reference) / (1000 * 60 * 60 * 24));
  return ((diffDays % 3) + 3) % 3;
}

export function getProntidaoDoDia(date: Date): EquipeProntidao {
  return EQUIPES_PRONTIDAO[getProntidaoIndex(date)];
}

export function getProntidaoDoDiaStr(dateStr: string): EquipeProntidao | null {
  if (!dateStr) return null;
  return getProntidaoDoDia(parseDateString(dateStr, "T12:00:00"));
}
