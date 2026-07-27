import { describe, expect, it } from "vitest";
import { Afastamento, Bombeiro, Fmo } from "../types";
import { PLANTOES_POR_CICLO_FMO, calculateFmoStatus } from "./fmo";
import { getProntidaoDoDia } from "./prontidao";

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

// Duty days of the VERDE team in 2026, in chronological order.
const diasVerde2026: string[] = [];
for (let day = new Date(2026, 0, 1); day.getFullYear() === 2026; day.setDate(day.getDate() + 1)) {
  if (getProntidaoDoDia(day) === "VERDE") {
    diasVerde2026.push(
      `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
    );
  }
}

const TODAY = new Date(2026, 6, 27, 12, 0, 0);

describe("calculateFmoStatus", () => {
  it("earns one FMO every nine duty days of the firefighter's team", () => {
    const status = calculateFmoStatus(bombeiro(), [], [], TODAY);

    expect(diasVerde2026).toHaveLength(122);
    expect(status.error).toBe(false);
    expect(status.conquistadas).toBe(Math.floor(diasVerde2026.length / PLANTOES_POR_CICLO_FMO));
    expect(status.progress).toBe(diasVerde2026.length % PLANTOES_POR_CICLO_FMO);
    expect(status.ciclos[0]).toEqual({ inicio: diasVerde2026[0], fim: diasVerde2026[8] });
    expect(status.usadas).toBe(0);
    expect(status.disponivel).toBe(status.conquistadas);
  });

  it("labels the last closed cycle with a short date range", () => {
    const status = calculateFmoStatus(bombeiro(), [], [], TODAY);
    const lastCycle = status.ciclos[status.ciclos.length - 1];

    expect(lastCycle.inicio).toBe(diasVerde2026[(status.conquistadas - 1) * PLANTOES_POR_CICLO_FMO]);
    expect(status.concessaoRange).toMatch(/^\d{2}[A-Z]{3} a \d{2}[A-Z]{3}$/);
  });

  it("subtracts FMOs already taken from the balance", () => {
    const fmos: Fmo[] = diasVerde2026.slice(50, 53).map((data, i) => ({
      id: `fmo${i}`,
      quartel_id: "q1",
      bombeiro_id: "b1",
      data
    }));
    const status = calculateFmoStatus(bombeiro(), [], fmos, TODAY);
    const baseline = calculateFmoStatus(bombeiro(), [], [], TODAY);

    expect(status.usadas).toBe(3);
    // The 3 FMO days do not count as served shifts, so fewer cycles are closed.
    expect(status.conquistadas).toBeLessThanOrEqual(baseline.conquistadas);
    expect(status.disponivel).toBe(Math.max(0, status.conquistadas - 3));
  });

  it("only considers records of the firefighter being evaluated", () => {
    const alheio: Fmo[] = [{ id: "fmo1", quartel_id: "q1", bombeiro_id: "b2", data: diasVerde2026[0] }];
    const status = calculateFmoStatus(bombeiro(), [], alheio, TODAY);

    expect(status.usadas).toBe(0);
    expect(status.ciclos[0].inicio).toBe(diasVerde2026[0]);
  });

  it("resets the running cycle when vacation covers duty days", () => {
    const ferias: Afastamento[] = [
      {
        id: "af1",
        quartel_id: "q1",
        bombeiro_id: "b1",
        data_inicio: "2026-01-01",
        data_fim: "2026-12-31",
        tipo: "Férias"
      }
    ];
    const status = calculateFmoStatus(bombeiro(), ferias, [], TODAY);

    expect(status.conquistadas).toBe(0);
    expect(status.progress).toBe(0);
    expect(status.ciclos).toEqual([]);
    expect(status.concessaoRange).toBe("");
    expect(status.previsaoConclusao).toBe("ciclo zerado");
  });

  it("only pauses the cycle for non-resetting leaves", () => {
    const licenca: Afastamento[] = [
      {
        id: "af1",
        quartel_id: "q1",
        bombeiro_id: "b1",
        data_inicio: diasVerde2026[3],
        data_fim: diasVerde2026[3],
        tipo: "Licença Médica"
      }
    ];
    const status = calculateFmoStatus(bombeiro(), licenca, [], TODAY);

    // The paused day is skipped, so the first cycle closes one duty day later.
    expect(status.ciclos[0]).toEqual({ inicio: diasVerde2026[0], fim: diasVerde2026[9] });
  });

  it("projects the completion date of the running cycle", () => {
    const status = calculateFmoStatus(bombeiro(), [], [], TODAY);
    expect(status.previsaoConclusao).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("skips duty days already reserved as FMO when projecting the cycle", () => {
    const proximosDiasVerde = diasVerde2026.filter(data => data > "2026-07-27");
    const fmos: Fmo[] = proximosDiasVerde.map((data, i) => ({
      id: `fmo${i}`,
      quartel_id: "q1",
      bombeiro_id: "b1",
      data
    }));
    const status = calculateFmoStatus(bombeiro(), [], fmos, TODAY);

    // Every remaining 2026 duty day is a paid folga, so the cycle can only close in 2027.
    expect(status.previsaoConclusao).toMatch(/^\d{2}\/\d{2}\/2027$/);
  });

  it("reports a zeroed cycle when no duty day can be served ahead", () => {
    const licenca: Afastamento[] = [
      {
        id: "af1",
        quartel_id: "q1",
        bombeiro_id: "b1",
        data_inicio: "2026-01-01",
        data_fim: "2027-12-31",
        tipo: "Licença Médica"
      }
    ];
    const status = calculateFmoStatus(bombeiro(), licenca, [], TODAY);

    expect(status.conquistadas).toBe(0);
    expect(status.previsaoConclusao).toBe("ciclo zerado");
  });

  it("reports an unknown forecast when the cycle cannot close within 200 days", () => {
    const licenca: Afastamento[] = [
      { id: "af1", quartel_id: "q1", bombeiro_id: "b1", data_inicio: "2026-01-01", data_fim: "2026-07-27", tipo: "Licença Médica" },
      { id: "af2", quartel_id: "q1", bombeiro_id: "b1", data_inicio: "2026-08-10", data_fim: "2027-12-31", tipo: "Licença Médica" }
    ];
    const status = calculateFmoStatus(bombeiro(), licenca, [], TODAY);

    expect(status.progress).toBeGreaterThan(0);
    expect(status.progress).toBeLessThan(PLANTOES_POR_CICLO_FMO);
    expect(status.previsaoConclusao).toBe("--");
  });

  it("rejects firefighters outside the stand-by regime", () => {
    const status = calculateFmoStatus(bombeiro({ regime: "EXPEDIENTE" }), [], [], TODAY);

    expect(status).toEqual({
      conquistadas: 0,
      usadas: 0,
      disponivel: 0,
      progress: 0,
      concessaoRange: "",
      previsaoConclusao: "regime expediente",
      ciclos: [],
      error: true
    });
  });

  it("defaults to the VERDE team when no team is assigned", () => {
    const withoutTeam = calculateFmoStatus(bombeiro({ equipe: "" }), [], [], TODAY);
    const verde = calculateFmoStatus(bombeiro(), [], [], TODAY);

    expect(withoutTeam.conquistadas).toBe(verde.conquistadas);
    expect(withoutTeam.ciclos).toEqual(verde.ciclos);
  });

  it("counts a different cadence for each team", () => {
    const azul = calculateFmoStatus(bombeiro({ equipe: "AZUL" }), [], [], TODAY);
    expect(azul.ciclos[0].inicio).toBe("2026-01-03");
  });
});
