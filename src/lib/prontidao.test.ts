import { describe, expect, it } from "vitest";
import { EQUIPES_PRONTIDAO, getProntidaoDoDia, getProntidaoDoDiaStr, getProntidaoIndex } from "./prontidao";

describe("getProntidaoIndex", () => {
  it("starts the cycle on the reference date", () => {
    expect(getProntidaoIndex(new Date(2026, 0, 1))).toBe(0);
  });

  it("advances one team per day", () => {
    expect(getProntidaoIndex(new Date(2026, 0, 2))).toBe(1);
    expect(getProntidaoIndex(new Date(2026, 0, 3))).toBe(2);
    expect(getProntidaoIndex(new Date(2026, 0, 4))).toBe(0);
  });

  it("stays positive for dates before the reference", () => {
    expect(getProntidaoIndex(new Date(2025, 11, 31))).toBe(2);
    expect(getProntidaoIndex(new Date(2025, 11, 30))).toBe(1);
  });

  it("ignores the time of day", () => {
    expect(getProntidaoIndex(new Date(2026, 0, 2, 23, 59, 59))).toBe(1);
  });
});

describe("getProntidaoDoDia", () => {
  it("maps the cycle index to a team color", () => {
    expect(getProntidaoDoDia(new Date(2026, 0, 1))).toBe("VERDE");
    expect(getProntidaoDoDia(new Date(2026, 0, 2))).toBe("AMARELA");
    expect(getProntidaoDoDia(new Date(2026, 0, 3))).toBe("AZUL");
  });

  it("only ever returns a known team", () => {
    for (let day = 1; day <= 31; day++) {
      expect(EQUIPES_PRONTIDAO).toContain(getProntidaoDoDia(new Date(2026, 4, day)));
    }
  });
});

describe("getProntidaoDoDiaStr", () => {
  it("resolves the team from an ISO date string", () => {
    expect(getProntidaoDoDiaStr("2026-01-01")).toBe("VERDE");
    expect(getProntidaoDoDiaStr("2026-07-27")).toBe(getProntidaoDoDia(new Date(2026, 6, 27)));
  });

  it("returns null for empty calendar cells", () => {
    expect(getProntidaoDoDiaStr("")).toBeNull();
  });
});
