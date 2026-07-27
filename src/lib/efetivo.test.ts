import { describe, expect, it } from "vitest";
import { Bombeiro } from "../types";
import { filterBombeiros, getEquipeCadastro } from "./efetivo";

const roster: Bombeiro[] = [
  {
    id: "b1",
    quartel_id: "q1",
    nome: "Carlos Henrique Ramos",
    nome_guerra: "Sgt Carlos",
    re: "122.505-X",
    posto_grad: "1º Sargento",
    status: "Ativo",
    especialidades: "Líder de Combate, Resgate em Altura"
  },
  {
    id: "b2",
    quartel_id: "q1",
    nome: "Bruno Silveira Melo",
    nome_guerra: "Sd Bruno",
    re: "181.332-9",
    posto_grad: "Soldado",
    status: "Férias",
    especialidades: "Salvamento Terrestre"
  },
  {
    id: "b3",
    quartel_id: "q2",
    nome: "Rodrigo Almeida",
    nome_guerra: "Sgt Almeida",
    re: "135.212-0",
    posto_grad: "2º Sargento",
    status: "Ativo"
  }
];

describe("filterBombeiros", () => {
  it("keeps only firefighters of the active station", () => {
    expect(filterBombeiros(roster, "q1").map(b => b.id)).toEqual(["b1", "b2"]);
    expect(filterBombeiros(roster, "q2").map(b => b.id)).toEqual(["b3"]);
  });

  it("applies the status filter", () => {
    expect(filterBombeiros(roster, "q1", "Férias").map(b => b.id)).toEqual(["b2"]);
    expect(filterBombeiros(roster, "q1", "Licença")).toEqual([]);
  });

  it("searches case-insensitively across name, war name, RE and specialities", () => {
    expect(filterBombeiros(roster, "q1", "Todos", "RAMOS").map(b => b.id)).toEqual(["b1"]);
    expect(filterBombeiros(roster, "q1", "Todos", "sd bruno").map(b => b.id)).toEqual(["b2"]);
    expect(filterBombeiros(roster, "q1", "Todos", "181.332").map(b => b.id)).toEqual(["b2"]);
    expect(filterBombeiros(roster, "q1", "Todos", "altura").map(b => b.id)).toEqual(["b1"]);
  });

  it("tolerates firefighters without specialities", () => {
    expect(filterBombeiros(roster, "q2", "Todos", "resgate")).toEqual([]);
  });
});

describe("getEquipeCadastro", () => {
  it("keeps the color team for stand-by regime", () => {
    expect(getEquipeCadastro("PRONTIDÃO", "AZUL")).toBe("AZUL");
  });

  it("clears the color team for office regime", () => {
    expect(getEquipeCadastro("EXPEDIENTE", "AZUL")).toBe("");
  });
});
