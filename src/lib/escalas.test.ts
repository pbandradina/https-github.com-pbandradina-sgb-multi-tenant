import { describe, expect, it } from "vitest";
import { Bombeiro, Escala } from "../types";
import {
  filterEscalas,
  findEscalaOnDate,
  findEscalasNoPeriodo,
  formatDateBr,
  getDatesWithEscalasDesc,
  groupEscalasByDate,
  isBeforeAdmissao,
  isPeriodoInvalido
} from "./escalas";

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

function bombeiro(overrides: Partial<Bombeiro> = {}): Bombeiro {
  return {
    id: "b1",
    quartel_id: "q1",
    nome: "Carlos Henrique Ramos",
    nome_guerra: "Sgt Carlos",
    re: "122.505-X",
    posto_grad: "1º Sargento",
    status: "Ativo",
    data_inicio_servico: "2018-11-20",
    ...overrides
  };
}

describe("filterEscalas", () => {
  const escalas = [
    escala({ id: "e1", data: "2026-05-04" }),
    escala({ id: "e2", data: "2026-05-05" }),
    escala({ id: "e3", quartel_id: "q2" })
  ];

  it("keeps only the shifts of the active station", () => {
    expect(filterEscalas(escalas, "q1").map(e => e.id)).toEqual(["e1", "e2"]);
  });

  it("narrows to a single date when a filter is given", () => {
    expect(filterEscalas(escalas, "q1", "2026-05-05").map(e => e.id)).toEqual(["e2"]);
    expect(filterEscalas(escalas, "q1", "2026-05-06")).toEqual([]);
  });
});

describe("groupEscalasByDate", () => {
  it("groups shifts under their date", () => {
    const grouped = groupEscalasByDate([
      escala({ id: "e1", data: "2026-05-04" }),
      escala({ id: "e2", data: "2026-05-04", bombeiro_id: "b2" }),
      escala({ id: "e3", data: "2026-05-06" })
    ]);

    expect(Object.keys(grouped).sort()).toEqual(["2026-05-04", "2026-05-06"]);
    expect(grouped["2026-05-04"].map(e => e.id)).toEqual(["e1", "e2"]);
  });

  it("returns an empty map for no shifts", () => {
    expect(groupEscalasByDate([])).toEqual({});
  });
});

describe("getDatesWithEscalasDesc", () => {
  it("orders dates from the most recent", () => {
    const grouped = groupEscalasByDate([
      escala({ id: "e1", data: "2026-05-04" }),
      escala({ id: "e2", data: "2026-06-01" }),
      escala({ id: "e3", data: "2026-05-30" })
    ]);

    expect(getDatesWithEscalasDesc(grouped)).toEqual(["2026-06-01", "2026-05-30", "2026-05-04"]);
  });
});

describe("findEscalasNoPeriodo", () => {
  const escalas = [
    escala({ id: "e1", data: "2026-05-09" }),
    escala({ id: "e2", data: "2026-05-10" }),
    escala({ id: "e3", data: "2026-05-20" }),
    escala({ id: "e4", data: "2026-05-21" }),
    escala({ id: "e5", data: "2026-05-15", bombeiro_id: "b2" })
  ];

  it("returns the firefighter's shifts inside the inclusive period", () => {
    expect(findEscalasNoPeriodo(escalas, "b1", "2026-05-10", "2026-05-20").map(e => e.id)).toEqual(["e2", "e3"]);
  });

  it("returns nothing when there is no collision", () => {
    expect(findEscalasNoPeriodo(escalas, "b1", "2026-05-11", "2026-05-19")).toEqual([]);
    expect(findEscalasNoPeriodo(escalas, "b3", "2026-05-01", "2026-05-31")).toEqual([]);
  });
});

describe("findEscalaOnDate", () => {
  it("finds the shift of a firefighter on an exact date", () => {
    const escalas = [escala(), escala({ id: "e2", bombeiro_id: "b2" })];
    expect(findEscalaOnDate(escalas, "b2", "2026-05-04")?.id).toBe("e2");
    expect(findEscalaOnDate(escalas, "b1", "2026-05-05")).toBeUndefined();
  });
});

describe("isBeforeAdmissao", () => {
  it("rejects dates before the firefighter joined active service", () => {
    expect(isBeforeAdmissao(bombeiro(), "2018-11-19")).toBe(true);
  });

  it("accepts the admission date itself and later dates", () => {
    expect(isBeforeAdmissao(bombeiro(), "2018-11-20")).toBe(false);
    expect(isBeforeAdmissao(bombeiro(), "2026-05-04")).toBe(false);
  });

  it("cannot judge firefighters without an admission date", () => {
    expect(isBeforeAdmissao(bombeiro({ data_inicio_servico: undefined }), "2000-01-01")).toBe(false);
    expect(isBeforeAdmissao(undefined, "2000-01-01")).toBe(false);
  });
});

describe("formatDateBr", () => {
  it("renders ISO dates in Brazilian format", () => {
    expect(formatDateBr("2018-11-20")).toBe("20/11/2018");
  });
});

describe("isPeriodoInvalido", () => {
  it("rejects periods that end before they start", () => {
    expect(isPeriodoInvalido("2026-05-10", "2026-05-09")).toBe(true);
  });

  it("accepts single day and forward periods", () => {
    expect(isPeriodoInvalido("2026-05-10", "2026-05-10")).toBe(false);
    expect(isPeriodoInvalido("2026-05-10", "2026-06-01")).toBe(false);
  });
});
