import { parseDateKey } from "./dates";

export const EQUIPES_PRONTIDAO = ["VERDE", "AMARELA", "AZUL"] as const;

export type EquipeProntidao = (typeof EQUIPES_PRONTIDAO)[number];

/** First day of the 3-team rotation cycle. */
const CICLO_REFERENCIA = new Date(2026, 0, 1);

export const getProntidaoIndex = (date: Date): number => {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((target - CICLO_REFERENCIA.getTime()) / (1000 * 60 * 60 * 24));
  return ((diffDays % EQUIPES_PRONTIDAO.length) + EQUIPES_PRONTIDAO.length) % EQUIPES_PRONTIDAO.length;
};

export const getProntidaoDoDia = (date: Date): EquipeProntidao => EQUIPES_PRONTIDAO[getProntidaoIndex(date)];

export const getProntidaoDoDiaKey = (dateKey: string): EquipeProntidao =>
  getProntidaoDoDia(parseDateKey(dateKey));

/** Picks the entry of a per-team lookup table matching the rotation of the given day. */
export const pickProntidaoStyle = <T>(date: Date, styles: Record<EquipeProntidao, T>): T =>
  styles[getProntidaoDoDia(date)];
