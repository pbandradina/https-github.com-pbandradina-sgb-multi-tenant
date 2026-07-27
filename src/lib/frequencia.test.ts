import { describe, expect, it } from "vitest";
import { Afastamento, Bombeiro, Escala, Fmo } from "../types";
import {
  LIMITE_HORAS_MES,
  computeFolhaFrequencia,
  computeFrequenciaMilitar,
  computeTotaisFrequencia,
  detectConflitosEscala,
  findAfastamentoOnDate,
  findFmoOnDate,
  getHorasPeriodo,
  isRegimeProntidao,
  matchesBombeiroSearch
} from "./frequencia";

function bombeiro(overrides: Partial<Bombeiro> = {}): Bombeiro {
  return {
    id: "b1",
    quartel_id: "q1",
    nome: "Carlos Henrique Ramos",
    nome_guerra: "Sgt Carlos",
    re: "122.505-X",
    posto_grad: "1º Sargento",
    status: "Ativo",
    regime: "PRONTIDÃO",
    equipe: "VERDE",
    ...overrides
  };
}

function escala(overrides: Partial<Escala> = {}): Escala {
  return {
    id: "e1",
    quartel_id: "q1",
    data: "2026-05-04",
    bombeiro_id: "b1",
    funcao: "Chefe de Guarnição",
    periodo: "24h",
    ...overrides
  };
}

function afastamento(overrides: Partial<Afastamento> = {}): Afastamento {
  return {
    id: "af1",
    quartel_id: "q1",
    bombeiro_id: "b1",
    data_inicio: "2026-05-10",
    data_fim: "2026-05-20",
    tipo: "Férias",
    ...overrides
  };
}

function fmo(overrides: Partial<Fmo> = {}): Fmo {
  return {
    id: "fmo1",
    quartel_id: "q1",
    bombeiro_id: "b1",
    data: "2026-05-07",
    ...overrides
  };
}

describe("getHorasPeriodo", () => {
  it("counts 24h shifts with night hours", () => {
    expect(getHorasPeriodo("24h")).toEqual({ horas: 24, noturnas: 7 });
  });

  it("counts night 12h shifts with night hours", () => {
    expect(getHorasPeriodo("Noturno 12h")).toEqual({ horas: 12, noturnas: 7 });
  });

  it("counts daytime and unknown periods as plain 12h", () => {
    expect(getHorasPeriodo("Diurno 12h")).toEqual({ horas: 12, noturnas: 0 });
    expect(getHorasPeriodo("Sobreaviso")).toEqual({ horas: 12, noturnas: 0 });
  });
});

describe("findAfastamentoOnDate", () => {
  const afastamentos = [afastamento(), afastamento({ id: "af2", bombeiro_id: "b2", data_inicio: "2026-06-01", data_fim: "2026-06-02", tipo: "Luto" })];

  it("matches the inclusive boundaries of the leave period", () => {
    expect(findAfastamentoOnDate(afastamentos, "b1", "2026-05-10")?.id).toBe("af1");
    expect(findAfastamentoOnDate(afastamentos, "b1", "2026-05-20")?.id).toBe("af1");
    expect(findAfastamentoOnDate(afastamentos, "b1", "2026-05-15")?.id).toBe("af1");
  });

  it("returns null outside the period or for other firefighters", () => {
    expect(findAfastamentoOnDate(afastamentos, "b1", "2026-05-09")).toBeNull();
    expect(findAfastamentoOnDate(afastamentos, "b1", "2026-05-21")).toBeNull();
    expect(findAfastamentoOnDate(afastamentos, "b1", "2026-06-01")).toBeNull();
  });
});

describe("findFmoOnDate", () => {
  it("matches on firefighter and exact date", () => {
    const fmos = [fmo(), fmo({ id: "fmo2", bombeiro_id: "b2", data: "2026-05-07" })];
    expect(findFmoOnDate(fmos, "b1", "2026-05-07")?.id).toBe("fmo1");
    expect(findFmoOnDate(fmos, "b1", "2026-05-08")).toBeUndefined();
    expect(findFmoOnDate(fmos, "b3", "2026-05-07")).toBeUndefined();
  });
});

describe("detectConflitosEscala", () => {
  it("flags shifts scheduled during a leave period", () => {
    const conflitos = detectConflitosEscala(
      [escala({ data: "2026-05-12" })],
      [bombeiro()],
      [afastamento()],
      []
    );
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0]).toMatchObject({ militar: "Sgt Carlos", data: "2026-05-12", tipo: "afastamento" });
    expect(conflitos[0].descricao).toContain("Férias");
  });

  it("flags shifts scheduled on an FMO day", () => {
    const conflitos = detectConflitosEscala([escala({ data: "2026-05-07" })], [bombeiro()], [], [fmo()]);
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].tipo).toBe("fmo");
  });

  it("reports both conflict kinds for the same shift", () => {
    const conflitos = detectConflitosEscala(
      [escala({ data: "2026-05-12" })],
      [bombeiro()],
      [afastamento()],
      [fmo({ data: "2026-05-12" })]
    );
    expect(conflitos.map(c => c.tipo)).toEqual(["afastamento", "fmo"]);
  });

  it("ignores shifts of firefighters outside the roster and conflict-free shifts", () => {
    expect(detectConflitosEscala([escala({ bombeiro_id: "ghost" })], [bombeiro()], [afastamento()], [fmo()])).toEqual([]);
    expect(detectConflitosEscala([escala({ data: "2026-05-04" })], [bombeiro()], [afastamento()], [fmo()])).toEqual([]);
  });
});

describe("computeFrequenciaMilitar", () => {
  it("accumulates hours, night hours and shift counts of the selected month", () => {
    const item = computeFrequenciaMilitar(
      bombeiro(),
      [
        escala({ id: "e1", data: "2026-05-01", periodo: "24h" }),
        escala({ id: "e2", data: "2026-05-04", periodo: "Noturno 12h" }),
        escala({ id: "e3", data: "2026-05-07", periodo: "Diurno 12h" }),
        escala({ id: "e4", data: "2026-04-30", periodo: "24h" })
      ],
      [],
      [],
      5,
      2026
    );

    expect(item.plantoesMes.map(e => e.id)).toEqual(["e1", "e2", "e3"]);
    expect(item.plantoesContagem).toBe(3);
    expect(item.horasTrabalhadas).toBe(48);
    expect(item.horasNoturnas).toBe(14);
    expect(item.horasExcedentes).toBe(0);
  });

  it("does not count shifts served while the firefighter was on leave", () => {
    const item = computeFrequenciaMilitar(
      bombeiro(),
      [escala({ id: "e1", data: "2026-05-04" }), escala({ id: "e2", data: "2026-05-12" })],
      [afastamento()],
      [],
      5,
      2026
    );

    expect(item.plantoesMes).toHaveLength(2);
    expect(item.plantoesContagem).toBe(1);
    expect(item.horasTrabalhadas).toBe(24);
  });

  it("reports hours above the monthly duty limit as surplus", () => {
    const escalas = Array.from({ length: 8 }, (_, i) =>
      escala({ id: `e${i}`, data: `2026-05-${String(i + 1).padStart(2, "0")}`, periodo: "24h" })
    );
    const item = computeFrequenciaMilitar(bombeiro(), escalas, [], [], 5, 2026);

    expect(item.horasTrabalhadas).toBe(192);
    expect(item.horasExcedentes).toBe(192 - LIMITE_HORAS_MES);
  });

  it("collects leaves overlapping the month and counts their days inclusively", () => {
    const item = computeFrequenciaMilitar(
      bombeiro(),
      [],
      [afastamento({ data_inicio: "2026-04-28", data_fim: "2026-05-02" })],
      [],
      5,
      2026
    );

    expect(item.afastamentosNoMes).toHaveLength(1);
    expect(item.diasAfastados).toBe(5);
  });

  it("collects only the FMOs of the selected month", () => {
    const item = computeFrequenciaMilitar(
      bombeiro(),
      [],
      [],
      [fmo(), fmo({ id: "fmo2", data: "2026-06-07" }), fmo({ id: "fmo3", bombeiro_id: "b2", data: "2026-05-09" })],
      5,
      2026
    );

    expect(item.fmosNoMes.map(f => f.id)).toEqual(["fmo1"]);
  });
});

describe("isRegimeProntidao", () => {
  it("treats a missing regime as stand-by duty", () => {
    expect(isRegimeProntidao(bombeiro({ regime: undefined }))).toBe(true);
    expect(isRegimeProntidao(bombeiro({ regime: "PRONTIDÃO" }))).toBe(true);
  });

  it("excludes office regime", () => {
    expect(isRegimeProntidao(bombeiro({ regime: "EXPEDIENTE" }))).toBe(false);
  });
});

describe("matchesBombeiroSearch", () => {
  it("matches case-insensitively on name, war name, RE and rank", () => {
    const militar = bombeiro();
    expect(matchesBombeiroSearch(militar, "")).toBe(true);
    expect(matchesBombeiroSearch(militar, "carlos")).toBe(true);
    expect(matchesBombeiroSearch(militar, "SGT")).toBe(true);
    expect(matchesBombeiroSearch(militar, "122.505")).toBe(true);
    expect(matchesBombeiroSearch(militar, "sargento")).toBe(true);
  });

  it("rejects unrelated terms", () => {
    expect(matchesBombeiroSearch(bombeiro(), "ferreira")).toBe(false);
  });
});

describe("computeFolhaFrequencia", () => {
  const roster = [
    bombeiro(),
    bombeiro({ id: "b2", nome: "Felipe Marcos Ferreira", nome_guerra: "Sd Ferreira", re: "172.903-1", posto_grad: "Soldado" }),
    bombeiro({ id: "b3", nome: "Souza Silva", nome_guerra: "1º Ten Souza", re: "145.230-1", posto_grad: "1º Tenente", regime: "EXPEDIENTE" })
  ];

  it("excludes office regime firefighters", () => {
    const folha = computeFolhaFrequencia(roster, [], [], [], 5, 2026);
    expect(folha.map(item => item.bombeiro.id)).toEqual(["b1", "b2"]);
  });

  it("applies the search filter after computing statistics", () => {
    const folha = computeFolhaFrequencia(roster, [escala()], [], [], 5, 2026, "ferreira");
    expect(folha).toHaveLength(1);
    expect(folha[0].bombeiro.id).toBe("b2");
    expect(folha[0].plantoesContagem).toBe(0);
  });
});

describe("computeTotaisFrequencia", () => {
  it("sums the sheet into station-wide totals", () => {
    const folha = computeFolhaFrequencia(
      [bombeiro(), bombeiro({ id: "b2", nome_guerra: "Sd Ferreira" })],
      [
        escala({ id: "e1", data: "2026-05-01", periodo: "24h" }),
        escala({ id: "e2", data: "2026-05-04", periodo: "Noturno 12h" }),
        escala({ id: "e3", data: "2026-05-04", bombeiro_id: "b2", periodo: "24h" })
      ],
      [afastamento({ bombeiro_id: "b2", data_inicio: "2026-05-25", data_fim: "2026-05-26", tipo: "Luto" })],
      [fmo()],
      5,
      2026
    );

    expect(computeTotaisFrequencia(folha)).toEqual({
      totalHorasGeraisDedicadas: 60,
      totalHorasNoturnasGerais: 21,
      totalHorasExcedentesGerais: 0,
      totalPlantoesGerais: 3,
      totalFmosGerais: 1,
      totalDiasAfastadosGerais: 2
    });
  });

  it("returns zeroed totals for an empty sheet", () => {
    expect(computeTotaisFrequencia([])).toEqual({
      totalHorasGeraisDedicadas: 0,
      totalHorasNoturnasGerais: 0,
      totalHorasExcedentesGerais: 0,
      totalPlantoesGerais: 0,
      totalFmosGerais: 0,
      totalDiasAfastadosGerais: 0
    });
  });
});
