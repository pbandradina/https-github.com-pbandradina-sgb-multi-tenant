import { Bombeiro } from "../types";

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

export function filterBombeiros(
  bombeiros: Bombeiro[],
  quartelId: string,
  statusFilter = "Todos",
  searchTerm = ""
): Bombeiro[] {
  const term = searchTerm.toLowerCase();
  return bombeiros.filter(b => {
    if (b.quartel_id !== quartelId) return false;
    if (statusFilter !== "Todos" && b.status !== statusFilter) return false;
    return (
      b.nome.toLowerCase().includes(term) ||
      b.nome_guerra.toLowerCase().includes(term) ||
      b.re.toLowerCase().includes(term) ||
      Boolean(b.especialidades && b.especialidades.toLowerCase().includes(term))
    );
  });
}

// Firefighters on stand-by regime belong to one of the rotating color teams.
export function getEquipeCadastro(regime: string, equipe: string): string {
  return regime === "PRONTIDÃO" ? equipe : "";
}
