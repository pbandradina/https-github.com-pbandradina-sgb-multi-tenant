import { Bombeiro, Escala } from "../types";
import { parseDateString } from "./dates";

export const FUNCOES_SP = [
  "Chefe de Guarnição / Comandante do Posto",
  "Motorista de Emergência (ABS - Auto Bomba)",
  "Motorista de Resgate (UR - Unidade de Resgate)",
  "Socorrista Resgatista (Auxiliar UR)",
  "Auxiliar de Bomba & Linha de Combate",
  "Condutor da Escada Mecânica (AEM)",
  "Telefonista / Despachante de Chamadas",
  "Sentinela / Guarda de Portão",
  "Auxiliar de Salvamento Terrestre"
];

export function filterEscalas(escalas: Escala[], quartelId: string, filterDate = ""): Escala[] {
  return escalas.filter(e => e.quartel_id === quartelId && (!filterDate || e.data === filterDate));
}

export function groupEscalasByDate(escalas: Escala[]): Record<string, Escala[]> {
  return escalas.reduce((groups: Record<string, Escala[]>, escala) => {
    if (!groups[escala.data]) groups[escala.data] = [];
    groups[escala.data].push(escala);
    return groups;
  }, {});
}

// Most recent duty date first, as displayed on the roster preview.
export function getDatesWithEscalasDesc(grouped: Record<string, Escala[]>): string[] {
  return Object.keys(grouped).sort().reverse();
}

export function findEscalasNoPeriodo(
  escalas: Escala[],
  militarId: string,
  inicioStr: string,
  fimStr: string
): Escala[] {
  const start = parseDateString(inicioStr);
  const end = parseDateString(fimStr);
  return escalas.filter(escala => {
    if (escala.bombeiro_id !== militarId) return false;
    const date = parseDateString(escala.data);
    return date >= start && date <= end;
  });
}

export function findEscalaOnDate(escalas: Escala[], militarId: string, dateStr: string): Escala | undefined {
  return escalas.find(escala => escala.bombeiro_id === militarId && escala.data === dateStr);
}

// A duty shift or FMO can never be recorded before the firefighter joined active service.
export function isBeforeAdmissao(bombeiro: Bombeiro | undefined, dateStr: string): boolean {
  if (!bombeiro || !bombeiro.data_inicio_servico) return false;
  return dateStr < bombeiro.data_inicio_servico;
}

export function formatDateBr(dateStr: string): string {
  return parseDateString(dateStr).toLocaleDateString("pt-BR");
}

export function isPeriodoInvalido(inicioStr: string, fimStr: string): boolean {
  return parseDateString(fimStr) < parseDateString(inicioStr);
}
