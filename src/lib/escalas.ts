export const PERIODOS_ESCALA = ["24h", "Diurno 12h", "Noturno 12h"];

/** Official duty roles used across the roster forms. */
export const FUNCOES_ESCALA = [
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

export const POSTOS_GRADUACOES = [
  "Soldado",
  "Cabo",
  "3º Sargento",
  "2º Sargento",
  "1º Sargento",
  "Subtenente",
  "2º Tenente",
  "1º Tenente",
  "Capitão"
];

export const LIMITE_HORAS_MES = 160;

/** Worked and night hours credited by a shift period. Unknown periods count as a 12h shift. */
export const horasDoPeriodo = (periodo: string): { horas: number; horasNoturnas: number } => {
  if (periodo === "24h") return { horas: 24, horasNoturnas: 7 };
  if (periodo === "Noturno 12h") return { horas: 12, horasNoturnas: 7 };
  return { horas: 12, horasNoturnas: 0 };
};

/** Short label used by the compact matrix cells ("24", "D12", "N12"). */
export const periodoAbrev = (periodo: string): string => {
  if (periodo === "24h") return "24";
  return periodo.includes("Diurno") ? "D12" : "N12";
};
