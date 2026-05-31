export interface Quartel {
  id: string;
  nome: string;
  cidade: string;
}

export interface Bombeiro {
  id: string;
  quartel_id: string;
  nome: string;
  nome_guerra: string;
  re: string;
  posto_grad: string;
  status: "Ativo" | "Licença" | "Férias" | string;
  telefone?: string;
  especialidades?: string;
  data_inicio_servico?: string; // YYYY-MM-DD format
  regime?: "PRONTIDÃO" | "EXPEDIENTE" | string;
  equipe?: "VERDE" | "AMARELA" | "AZUL" | string;
}

export interface Escala {
  id: string;
  quartel_id: string;
  data: string; // YYYY-MM-DD format
  bombeiro_id: string;
  funcao: string;
  periodo: "24h" | "Diurno 12h" | "Noturno 12h" | string;
}

export interface Viatura {
  id: string;
  quartel_id: string;
  codigo: string;
  tipo: string;
  status: "Pronta para Serviço" | "Em Manutenção" | "Em Ocorrência" | string;
  escala_atual: string; // comma-separated list of Bombeiro IDs
}

export interface Ocorrencia {
  id: string;
  quartel_id: string;
  codigo: string;
  tipo: string;
  endereco: string;
  viatura_id: string | null;
  status: "Ativa" | "Finalizada" | string;
  criado_em: string;
  fechado_em: string | null;
  historico?: string;
}

export interface MuralPost {
  id: string;
  quartel_id: string;
  titulo: string;
  conteudo: string;
  bombeiro_re?: string;
  criado_em: string;
}

export interface Afastamento {
  id: string;
  quartel_id: string;
  bombeiro_id: string;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;    // YYYY-MM-DD
  tipo: "Férias" | "Licença Médica" | "Licença Prêmio" | "Luto" | "Núpcias" | string;
  justificativa?: string;
}

export interface Fmo {
  id: string;
  quartel_id: string;
  bombeiro_id: string;
  data: string; // YYYY-MM-DD
  justificativa?: string;
}

