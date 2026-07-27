import express, { NextFunction, Request, RequestHandler, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const dbUrl = process.env.SUPABASE_DB_URL;

let pool: pg.Pool | null = null;
let isDbConnected = false;
let dbConnectionStringRef = "";
let dbInitError: string | null = null;

// Erro com status HTTP e mensagem destinada ao cliente
class HttpError extends Error {
  constructor(readonly status: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "HttpError";
  }
}

const describeError = (err: unknown): string => {
  if (err instanceof Error) {
    const cause = err.cause !== undefined ? ` (causa: ${describeError(err.cause)})` : "";
    return `${err.message}${cause}`;
  }
  return String(err);
};

// O Express 4 não captura rejeições de handlers async: sem este wrapper a
// requisição fica pendurada e o erro só aparece como unhandledRejection.
const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req, res).catch(next);
  };

const requireFields = (body: Record<string, unknown>, fields: string[]) => {
  const missing = fields.filter(field => {
    const value = body[field];
    return value === undefined || value === null || value === "";
  });
  if (missing.length > 0) {
    throw new HttpError(400, `Campos obrigatórios ausentes: ${missing.join(", ")}`);
  }
};

// Executa a query informando qual operação falhou, em vez de mascarar o erro
const runQuery = async (context: string, query: () => Promise<pg.QueryResult>) => {
  try {
    return await query();
  } catch (err) {
    throw new HttpError(500, context, { cause: err });
  }
};

const requireDb = (): pg.Pool | null => (isDbConnected && pool ? pool : null);

// Graceful Mock Fallback Data (In-Memory database) to guarantee flawless reliability
let mockQuarteis = [
  { id: "q1", nome: "Posto de Bombeiros de Andradina", cidade: "Andradina", subgrupamento: "2º SGB" },
  { id: "q_pereira", nome: "Estação de Bombeiros de Pereira Barreto", cidade: "Pereira Barreto", subgrupamento: "2º SGB" },
  { id: "q_ilha", nome: "Estação de Bombeiros de Ilha Solteira", cidade: "Ilha Solteira", subgrupamento: "2º SGB" },
  { id: "q_santana", nome: "Posto de Bombeiros Santana", cidade: "Santana", subgrupamento: "1º SGB" },
  { id: "q_jussara", nome: "Posto de Bombeiros Jussara", cidade: "Jussara", subgrupamento: "1º SGB" },
  { id: "q_birigui", nome: "Posto de Bombeiros Birigui", cidade: "Birigui", subgrupamento: "1º SGB" },
  { id: "q_penapolis", nome: "Estação de Bombeiros Penápolis", cidade: "Penápolis", subgrupamento: "1º SGB" }
];

let mockBombeiros = [
  { id: "b1", quartel_id: "q1", nome: "Souza Silva", nome_guerra: "1º Ten Souza", re: "145.230-1", posto_grad: "1º Tenente", status: "Ativo", telefone: "(18) 99761-1223", especialidades: "Comandante de Equipe, Motorista", data_inicio_servico: "2015-02-01", regime: "EXPEDIENTE", equipe: "" },
  { id: "b2", quartel_id: "q1", nome: "Roberto de Oliveira", nome_guerra: "Subten Roberto", re: "132.404-2", posto_grad: "Subtenente", status: "Ativo", telefone: "(18) 99652-3344", especialidades: "Socorrista, Auto Escada", data_inicio_servico: "2016-08-16", regime: "EXPEDIENTE", equipe: "" },
  { id: "b3", quartel_id: "q1", nome: "Carlos Henrique Ramos", nome_guerra: "Sgt Carlos", re: "122.505-X", posto_grad: "1º Sargento", status: "Ativo", telefone: "(18) 99111-8877", especialidades: "Líder de Combate, Resgate em Altura", data_inicio_servico: "2018-11-20", regime: "PRONTIDÃO", equipe: "VERDE" },
  { id: "b4", quartel_id: "q1", nome: "André Souza Lima", nome_guerra: "Cb André", re: "156.708-3", posto_grad: "Cabo", status: "Ativo", telefone: "(18) 99802-5566", especialidades: "Motorista de Emergência, Socorrista", data_inicio_servico: "2020-05-12", regime: "PRONTIDÃO", equipe: "AMARELA" },
  { id: "b5", quartel_id: "q1", nome: "Felipe Marcos Ferreira", nome_guerra: "Sd Ferreira", re: "172.903-1", posto_grad: "Soldado", status: "Ativo", telefone: "(18) 98114-1234", especialidades: "Combate a Incêndio, Resgate Aquático", data_inicio_servico: "2022-10-01", regime: "PRONTIDÃO", equipe: "AZUL" },
  { id: "b6", quartel_id: "q1", nome: "Gabriel Santos Lima", nome_guerra: "Sd Lima", re: "178.502-4", posto_grad: "Soldado", status: "Ativo", telefone: "(18) 99602-9988", especialidades: "Auxiliar de Linha, Telecomunicações", data_inicio_servico: "2023-01-15", regime: "PRONTIDÃO", equipe: "VERDE" },
  { id: "b7", quartel_id: "q1", nome: "Marcos Ribeiro Santos", nome_guerra: "Sd Santos", re: "169.400-0", posto_grad: "Soldado", status: "Ativo", telefone: "(18) 99755-4422", especialidades: "Combate a Incêndio Florestal", data_inicio_servico: "2024-06-01", regime: "PRONTIDÃO", equipe: "AMARELA" },
  { id: "b8", quartel_id: "q1", nome: "Bruno Silveira Melo", nome_guerra: "Sd Bruno", re: "181.332-9", posto_grad: "Soldado", status: "Férias", telefone: "(18) 99600-1122", especialidades: "Salvamento Terrestre", data_inicio_servico: "2024-11-10", regime: "PRONTIDÃO", equipe: "AZUL" },
  
  // Castilho
  { id: "b9", quartel_id: "q2", nome: "Rodrigo Almeida", nome_guerra: "Sgt Almeida", re: "135.212-0", posto_grad: "2º Sargento", status: "Ativo", telefone: "(18) 99890-7766", especialidades: "Motorista, Socorrista", data_inicio_servico: "2020-01-10", regime: "PRONTIDÃO", equipe: "VERDE" },
  { id: "b10", quartel_id: "q2", nome: "Paula Cristina Neves", nome_guerra: "Sd Paula", re: "179.330-1", posto_grad: "Soldado", status: "Ativo", telefone: "(18) 99788-2233", especialidades: "Combate a Incêndio, Atendimento Pré-Hospitalar", data_inicio_servico: "2023-05-20", regime: "PRONTIDÃO", equipe: "AMARELA" },
  
  // Pereira Barreto
  { id: "b11", quartel_id: "q3", nome: "Julio Cesar Duarte", nome_guerra: "Sgt Duarte", re: "119.800-4", posto_grad: "1º Sargento", status: "Ativo", telefone: "(18) 99123-5599", especialidades: "Salvamento Aquático, Comandante", data_inicio_servico: "2017-04-15", regime: "PRONTIDÃO", equipe: "AZUL" },
  { id: "b12", quartel_id: "q3", nome: "Thiago Gomes", nome_guerra: "Sd Gomes", re: "185.201-2", posto_grad: "Soldado", status: "Ativo", telefone: "(18) 99611-0022", especialidades: "Combate a Incêndio, Resgate", data_inicio_servico: "2022-09-01", regime: "PRONTIDÃO", equipe: "VERDE" }
];

// Helper to convert date to YYYY-MM-DD
const formatDate = (d: Date | string) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `Data inválida: ${JSON.stringify(d)}`);
  }
  return date.toISOString().split("T")[0];
};

let mockEscalas = [
  { id: "e1", quartel_id: "q1", data: formatDate(new Date()), bombeiro_id: "b3", funcao: "Chefe de Guarnição / Comandante", periodo: "24h" },
  { id: "e2", quartel_id: "q1", data: formatDate(new Date()), bombeiro_id: "b4", funcao: "Motorista da Auto Bomba (ABS)", periodo: "24h" },
  { id: "e3", quartel_id: "q1", data: formatDate(new Date()), bombeiro_id: "b5", funcao: "Socorrista da Unidade de Resgate (UR)", periodo: "24h" },
  { id: "e4", quartel_id: "q1", data: formatDate(new Date()), bombeiro_id: "b6", funcao: "Auxiliar de Combate", periodo: "24h" },
  { id: "e5", quartel_id: "q1", data: formatDate(new Date()), bombeiro_id: "b7", funcao: "Operador de Telecomunicações", periodo: "24h" }
];

let mockViaturas = [
  { id: "v1", quartel_id: "q1", codigo: "ABS-201", tipo: "Auto Bomba Salvação", status: "Pronta para Serviço", escala_atual: "b4,b3,b6" },
  { id: "v2", quartel_id: "q1", codigo: "UR-205", tipo: "Unidade de Resgate", status: "Pronta para Serviço", escala_atual: "b5" },
  { id: "v3", quartel_id: "q1", codigo: "AEM-202", tipo: "Auto Escada Mecânica", status: "Pronta para Serviço", escala_atual: "b2" },
  { id: "v4", quartel_id: "q1", codigo: "AT-208", tipo: "Auto Tanque de Apoio", status: "Pronta para Serviço", escala_atual: "" },
  { id: "v5", quartel_id: "q1", codigo: "ASE-203", tipo: "Auto Salvamento Especial", status: "Em Manutenção", escala_atual: "" }
];

let mockOcorrencias = [
  { id: "o1", quartel_id: "q1", codigo: "OCO-2026-101", tipo: "Colisão de Trânsito com Vítima Presa em Ferragens", endereco: "Av. Guanabara, 1200 - Centro, Andradina", viatura_id: "v2", status: "Finalizada", criado_em: new Date(Date.now() - 3600000 * 5).toISOString(), fechado_em: new Date(Date.now() - 3600000 * 4).toISOString(), historico: "Viatura UR-205 respondeu ao local. Uma vítima leve socorrida e conduzida ao UPA de Andradina." },
  { id: "o2", quartel_id: "q1", codigo: "OCO-2026-102", tipo: "Incêndio em Vegetação Seca (Lote Urbano)", endereco: "Rua Ceará, próximo ao trevo da SP-300 - Andradina", viatura_id: "v1", status: "Ativa", criado_em: new Date(Date.now() - 1800000).toISOString(), fechado_em: null, historico: "Viatura ABS-201 deslocada com guarnição completa. Combate em andamento e resfriamento do local." }
];

let mockMural = [
  { id: "m1", quartel_id: "q1", titulo: "Instrução de Salvamento em Altura", conteudo: "Treinamento obrigatório de resgate vertical agendado para o próximo sábado na torre de treinamento, às 08:00h. Trazer EPI completo.", bombeiro_re: "145.230-1", criado_em: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: "m2", quartel_id: "q1", titulo: "Manutenção Preventiva das Viaturas", conteudo: "O veículo ASE-203 passará por troca de óleo e vistoria completa dos comandos hidráulicos esta semana. Atenção aos checklists diários.", bombeiro_re: "132.404-2", criado_em: new Date(Date.now() - 86400000).toISOString() }
];

let mockAfastamentos = [
  { id: "af_1", quartel_id: "q1", bombeiro_id: "b8", data_inicio: "2026-05-15", data_fim: "2026-06-14", tipo: "Férias", justificativa: "Férias Regulamentares Ano Base 2025" }
];

let mockFmos = [
  { id: "fmo_1", quartel_id: "q1", bombeiro_id: "b4", data: "2026-05-28", justificativa: "FMO - Compensação Escala" },
  { id: "fmo_2", quartel_id: "q1", bombeiro_id: "b5", data: "2026-05-25", justificativa: "Folga Escala PMESP" }
];

let mockAdmins = [
  { username: "admin", nome: "Administrador 20º GB", password: "sgb20gb" }
];

// Iniciar conexão com Supabase Postgres
async function initDb() {
  console.log("Tentando conectar com o banco Supabase PostgreSQL...");
  
  if (!dbUrl) {
    console.warn("Nenhuma URL de banco de dados fornecida. Usando modo Em Memória.");
    return false;
  }

  // Mascarar dados de login para visualização em logs
  const maskedConn = dbUrl.replace(/:([^:@]+)@/, ":*****@");
  console.log("URL de Conexão:", maskedConn);
  dbConnectionStringRef = maskedConn;

  try {
    pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false } // Supabase exige SSL
    });

    // Sem este listener um erro em cliente idle derruba o processo
    pool.on("error", err => {
      console.error("Erro inesperado em cliente idle do pool PostgreSQL:", describeError(err));
    });

    // Testar conexão
    const res = await pool.query("SELECT NOW()");
    console.log("Conectado com sucesso ao Supabase PostgreSQL! Hora do Banco:", res.rows[0].now);
    isDbConnected = true;

    // Criar tabelas se não existirem
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quarteis (
        id VARCHAR(50) PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        cidade VARCHAR(100) NOT NULL,
        subgrupamento VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS administradores (
        username VARCHAR(50) PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        password VARCHAR(100) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bombeiros (
        id VARCHAR(50) PRIMARY KEY,
        quartel_id VARCHAR(50) NOT NULL,
        nome VARCHAR(100) NOT NULL,
        nome_guerra VARCHAR(50) NOT NULL,
        re VARCHAR(20) NOT NULL,
        posto_grad VARCHAR(30) NOT NULL,
        status VARCHAR(20) DEFAULT 'Ativo',
        telefone VARCHAR(20),
        especialidades VARCHAR(500),
        data_inicio_servico VARCHAR(20),
        regime VARCHAR(30) DEFAULT 'PRONTIDÃO',
        equipe VARCHAR(30) DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS escalas (
        id VARCHAR(50) PRIMARY KEY,
        quartel_id VARCHAR(50) NOT NULL,
        data DATE NOT NULL,
        bombeiro_id VARCHAR(50) NOT NULL,
        funcao VARCHAR(100) NOT NULL,
        periodo VARCHAR(30) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS viaturas (
        id VARCHAR(50) PRIMARY KEY,
        quartel_id VARCHAR(50) NOT NULL,
        codigo VARCHAR(20) NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        status VARCHAR(30) DEFAULT 'Pronta para Serviço',
        escala_atual TEXT
      );

      CREATE TABLE IF NOT EXISTS ocorrencias (
        id VARCHAR(50) PRIMARY KEY,
        quartel_id VARCHAR(50) NOT NULL,
        codigo VARCHAR(30) NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        endereco VARCHAR(200) NOT NULL,
        viatura_id VARCHAR(50),
        status VARCHAR(20) DEFAULT 'Ativa',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fechado_em TIMESTAMP,
        historico TEXT
      );

      CREATE TABLE IF NOT EXISTS mural_avisos (
        id VARCHAR(50) PRIMARY KEY,
        quartel_id VARCHAR(50) NOT NULL,
        titulo VARCHAR(100) NOT NULL,
        conteudo TEXT NOT NULL,
        bombeiro_re VARCHAR(50),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS afastamentos (
        id VARCHAR(50) PRIMARY KEY,
        quartel_id VARCHAR(50) NOT NULL,
        bombeiro_id VARCHAR(50) NOT NULL,
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        justificativa VARCHAR(250)
      );

      CREATE TABLE IF NOT EXISTS fmos (
        id VARCHAR(50) PRIMARY KEY,
        quartel_id VARCHAR(50) NOT NULL,
        bombeiro_id VARCHAR(50) NOT NULL,
        data DATE NOT NULL,
        justificativa VARCHAR(250)
      );
    `);

    // Ensure database schema supports data_inicio_servico representing service entry/admission
    await pool.query(`
      ALTER TABLE bombeiros ADD COLUMN IF NOT EXISTS data_inicio_servico VARCHAR(20);
      ALTER TABLE bombeiros ADD COLUMN IF NOT EXISTS regime VARCHAR(30) DEFAULT 'PRONTIDÃO';
      ALTER TABLE bombeiros ADD COLUMN IF NOT EXISTS equipe VARCHAR(30) DEFAULT '';
      ALTER TABLE quarteis ADD COLUMN IF NOT EXISTS subgrupamento VARCHAR(50);
    `);

    console.log("Banco de dados verificado/estruturado com sucesso.");

    // Seeding/Updating standard 20º GB fire stations
    for (const q of mockQuarteis) {
      await pool.query(`
        INSERT INTO quarteis (id, nome, cidade, subgrupamento)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          cidade = EXCLUDED.cidade,
          subgrupamento = EXCLUDED.subgrupamento
      `, [q.id, q.nome, q.cidade, q.subgrupamento]);
    }
    console.log("Seeding dos Quartéis (1º e 2º SGB do 20º GB) finalizado.");

    // Seeding default administrator if empty
    const countAdmins = await pool.query("SELECT COUNT(*) FROM administradores");
    if (parseInt(countAdmins.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO administradores (username, nome, password)
        VALUES ($1, $2, $3)
      `, ["admin", "Administrador 20º GB", "sgb20gb"]);
      console.log("Administrador padrão ('admin' / 'sgb20gb') semeado com sucesso.");
    }

    // Se as tabelas estiverem totalmente vazias, popular com dados iniciais
    const countBombeiros = await pool.query("SELECT COUNT(*) FROM bombeiros");
    if (parseInt(countBombeiros.rows[0].count) === 0) {
      console.log("Banco de dados vazio! Populando dados iniciais das guarnições...");
      for (const b of mockBombeiros) {
        await pool.query("INSERT INTO bombeiros (id, quartel_id, nome, nome_guerra, re, posto_grad, status, telefone, especialidades, data_inicio_servico, regime, equipe) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)", 
          [b.id, b.quartel_id, b.nome, b.nome_guerra, b.re, b.posto_grad, b.status, b.telefone, b.especialidades, b.data_inicio_servico, b.regime || "PRONTIDÃO", b.equipe || ""]);
      }
      for (const e of mockEscalas) {
        await pool.query("INSERT INTO escalas (id, quartel_id, data, bombeiro_id, funcao, periodo) VALUES ($1, $2, $3, $4, $5, $6)", 
          [e.id, e.quartel_id, e.data, e.bombeiro_id, e.funcao, e.periodo]);
      }
      for (const v of mockViaturas) {
        await pool.query("INSERT INTO viaturas (id, quartel_id, codigo, tipo, status, escala_atual) VALUES ($1, $2, $3, $4, $5, $6)", 
          [v.id, v.quartel_id, v.codigo, v.tipo, v.status, v.escala_atual]);
      }
      for (const o of mockOcorrencias) {
        await pool.query("INSERT INTO ocorrencias (id, quartel_id, codigo, tipo, endereco, viatura_id, status, criado_em, fechado_em, historico) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", 
          [o.id, o.quartel_id, o.codigo, o.tipo, o.endereco, o.viatura_id, o.status, o.criado_em, o.fechado_em, o.historico]);
      }
      for (const m of mockMural) {
        await pool.query("INSERT INTO mural_avisos (id, quartel_id, titulo, conteudo, bombeiro_re, criado_em) VALUES ($1, $2, $3, $4, $5, $6)", 
          [m.id, m.quartel_id, m.titulo, m.conteudo, m.bombeiro_re, m.criado_em]);
      }
      for (const af of mockAfastamentos) {
        await pool.query("INSERT INTO afastamentos (id, quartel_id, bombeiro_id, data_inicio, data_fim, tipo, justificativa) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [af.id, af.quartel_id, af.bombeiro_id, af.data_inicio, af.data_fim, af.tipo, af.justificativa]);
      }
      for (const fmo of mockFmos) {
        await pool.query("INSERT INTO fmos (id, quartel_id, bombeiro_id, data, justificativa) VALUES ($1, $2, $3, $4, $5)",
          [fmo.id, fmo.quartel_id, fmo.bombeiro_id, fmo.data, fmo.justificativa]);
      }
      console.log("Dados iniciais semeados com sucesso.");
    }
    
    return true;
  } catch (err) {
    console.error("Erro ao conectar ou configurar o PostgreSQL do Supabase:", err);
    console.warn("Utilizando persistência Em Memória temporária para manter a aplicação 100% ativa!");
    isDbConnected = false;
    dbInitError = describeError(err);
    return false;
  }
}

initDb().catch(err => {
  // initDb já trata suas falhas; um erro aqui é inesperado e não pode ser perdido
  dbInitError = describeError(err);
  isDbConnected = false;
  console.error("Falha não tratada ao inicializar o banco de dados:", err);
});

// --- ENDPOINTS DA API ---

// 1. Status Connection
app.get("/api/status", (req, res) => {
  res.json({
    connected: isDbConnected,
    database: "PostgreSQL - Supabase",
    connectionString: dbConnectionStringRef || "In-Memory Fallback Client",
    // Expõe o motivo da degradação para Em Memória em vez de deixá-lo apenas no log
    error: dbInitError,
    time: new Date().toISOString()
  });
});

// 2. Quarteis (Unidades)
app.get("/api/quarteis", asyncHandler(async (req, res) => {
  const db = requireDb();
  if (!db) return res.json(mockQuarteis);
  const result = await runQuery("Erro ao consultar quartéis.", () => db.query("SELECT * FROM quarteis ORDER BY nome"));
  res.json(result.rows);
}));

// 3. Bombeiros (Efetivo)
app.get("/api/bombeiros", asyncHandler(async (req, res) => {
  const db = requireDb();
  if (!db) return res.json(mockBombeiros);
  const result = await runQuery("Erro ao consultar bombeiros.", () =>
    db.query("SELECT * FROM bombeiros ORDER BY posto_grad ASC, nome ASC"));
  res.json(result.rows);
}));

app.post("/api/bombeiros", asyncHandler(async (req, res) => {
  requireFields(req.body, ["quartel_id", "nome", "nome_guerra", "re", "posto_grad"]);
  const { id, quartel_id, nome, nome_guerra, re, posto_grad, status, telefone, especialidades, data_inicio_servico, regime, equipe } = req.body;
  const newId = id || "b_" + Date.now();

  const db = requireDb();
  if (db) {
    await runQuery("Erro ao salvar bombeiro.", () => db.query(`
      INSERT INTO bombeiros (id, quartel_id, nome, nome_guerra, re, posto_grad, status, telefone, especialidades, data_inicio_servico, regime, equipe)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        quartel_id = EXCLUDED.quartel_id,
        nome = EXCLUDED.nome,
        nome_guerra = EXCLUDED.nome_guerra,
        re = EXCLUDED.re,
        posto_grad = EXCLUDED.posto_grad,
        status = EXCLUDED.status,
        telefone = EXCLUDED.telefone,
        especialidades = EXCLUDED.especialidades,
        data_inicio_servico = EXCLUDED.data_inicio_servico,
        regime = EXCLUDED.regime,
        equipe = EXCLUDED.equipe
    `, [newId, quartel_id, nome, nome_guerra, re, posto_grad, status || "Ativo", telefone, especialidades, data_inicio_servico, regime || "PRONTIDÃO", equipe || ""]));

    const updated = await runQuery("Erro ao recarregar bombeiro salvo.", () =>
      db.query("SELECT * FROM bombeiros WHERE id = $1", [newId]));
    if (updated.rows.length === 0) {
      throw new HttpError(500, "Bombeiro não encontrado após a gravação.");
    }
    return res.json(updated.rows[0]);
  }

  // Fallback Local Cache
  const existingIndex = mockBombeiros.findIndex(b => b.id === newId);
  const data = { id: newId, quartel_id, nome, nome_guerra, re, posto_grad, status: status || "Ativo", telefone, especialidades, data_inicio_servico, regime: regime || "PRONTIDÃO", equipe: equipe || "" };
  if (existingIndex > -1) {
    mockBombeiros[existingIndex] = data;
  } else {
    mockBombeiros.push(data);
  }
  res.json(data);
}));

app.delete("/api/bombeiros/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = requireDb();
  if (db) {
    const result = await runQuery("Erro ao deletar bombeiro.", () =>
      db.query("DELETE FROM bombeiros WHERE id = $1", [id]));
    return res.json({ success: true, deleted: result.rowCount ?? 0 });
  }
  const before = mockBombeiros.length;
  mockBombeiros = mockBombeiros.filter(b => b.id !== id);
  res.json({ success: true, deleted: before - mockBombeiros.length });
}));

// 4. Escalas de Plantão (Shifts)
app.get("/api/escalas", asyncHandler(async (req, res) => {
  const db = requireDb();
  if (!db) return res.json(mockEscalas);
  const result = await runQuery("Erro ao consultar escalas.", () => db.query("SELECT * FROM escalas ORDER BY data DESC"));
  // Map postgres date properly (strip timestamp text)
  res.json(result.rows.map(row => ({ ...row, data: formatDate(row.data) })));
}));

app.post("/api/escalas", asyncHandler(async (req, res) => {
  requireFields(req.body, ["quartel_id", "data", "bombeiro_id", "funcao", "periodo"]);
  const { id, quartel_id, data, bombeiro_id, funcao, periodo } = req.body;
  const newId = id || "e_" + Date.now();
  const rawDate = formatDate(data);

  const db = requireDb();
  if (db) {
    await runQuery("Erro ao salvar escala.", () => db.query(`
      INSERT INTO escalas (id, quartel_id, data, bombeiro_id, funcao, periodo)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        quartel_id = EXCLUDED.quartel_id,
        data = EXCLUDED.data,
        bombeiro_id = EXCLUDED.bombeiro_id,
        funcao = EXCLUDED.funcao,
        periodo = EXCLUDED.periodo
    `, [newId, quartel_id, rawDate, bombeiro_id, funcao, periodo]));
    return res.json({ id: newId, quartel_id, data: rawDate, bombeiro_id, funcao, periodo });
  }

  // Fallback Local
  const existingIndex = mockEscalas.findIndex(e => e.id === newId);
  const dataset = { id: newId, quartel_id, data: rawDate, bombeiro_id, funcao, periodo };
  if (existingIndex > -1) {
    mockEscalas[existingIndex] = dataset;
  } else {
    mockEscalas.push(dataset);
  }
  res.json(dataset);
}));

app.delete("/api/escalas/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = requireDb();
  if (db) {
    const result = await runQuery("Erro ao deletar escala.", () =>
      db.query("DELETE FROM escalas WHERE id = $1", [id]));
    return res.json({ success: true, deleted: result.rowCount ?? 0 });
  }
  const before = mockEscalas.length;
  mockEscalas = mockEscalas.filter(e => e.id !== id);
  res.json({ success: true, deleted: before - mockEscalas.length });
}));

// 5. Viaturas (Fleet)
app.get("/api/viaturas", asyncHandler(async (req, res) => {
  const db = requireDb();
  if (!db) return res.json(mockViaturas);
  const result = await runQuery("Erro ao consultar viaturas.", () => db.query("SELECT * FROM viaturas ORDER BY codigo"));
  res.json(result.rows);
}));

app.put("/api/viaturas/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, escala_atual } = req.body;

  const db = requireDb();
  if (db) {
    const updateResult = await runQuery("Erro ao atualizar viatura.", () => db.query(
      "UPDATE viaturas SET status = $1, escala_atual = $2 WHERE id = $3",
      [status, escala_atual, id]
    ));
    if (updateResult.rowCount === 0) {
      throw new HttpError(404, "Viatura não encontrada.");
    }
    const updated = await runQuery("Erro ao recarregar viatura atualizada.", () =>
      db.query("SELECT * FROM viaturas WHERE id = $1", [id]));
    return res.json(updated.rows[0]);
  }

  const index = mockViaturas.findIndex(v => v.id === id);
  if (index === -1) {
    throw new HttpError(404, "Viatura não encontrada.");
  }
  mockViaturas[index] = { ...mockViaturas[index], status, escala_atual };
  res.json(mockViaturas[index]);
}));

// 6. Ocorrências (Dispatches)
app.get("/api/ocorrencias", asyncHandler(async (req, res) => {
  const db = requireDb();
  if (!db) return res.json(mockOcorrencias);
  const result = await runQuery("Erro ao consultar ocorrências.", () =>
    db.query("SELECT * FROM ocorrencias ORDER BY criado_em DESC"));
  res.json(result.rows);
}));

app.post("/api/ocorrencias", asyncHandler(async (req, res) => {
  requireFields(req.body, ["quartel_id", "tipo", "endereco"]);
  const { id, quartel_id, tipo, endereco, viatura_id, status, historico, criado_em, fechado_em } = req.body;
  const newId = id || "o_" + Date.now();
  const finalCode = "OCO-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900);
  const startTime = criado_em || new Date().toISOString();

  const db = requireDb();
  if (db) {
    await runQuery("Erro ao registrar ocorrência.", () => db.query(`
      INSERT INTO ocorrencias (id, quartel_id, codigo, tipo, endereco, viatura_id, status, criado_em, fechado_em, historico)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        tipo = EXCLUDED.tipo,
        endereco = EXCLUDED.endereco,
        viatura_id = EXCLUDED.viatura_id,
        status = EXCLUDED.status,
        fechado_em = EXCLUDED.fechado_em,
        historico = EXCLUDED.historico
    `, [newId, quartel_id, finalCode, tipo, endereco, viatura_id, status || "Ativa", startTime, fechado_em, historico]));

    const loaded = await runQuery("Erro ao recarregar ocorrência registrada.", () =>
      db.query("SELECT * FROM ocorrencias WHERE id = $1", [newId]));
    if (loaded.rows.length === 0) {
      throw new HttpError(500, "Ocorrência não encontrada após o registro.");
    }
    return res.json(loaded.rows[0]);
  }

  const existingIndex = mockOcorrencias.findIndex(o => o.id === newId);
  const data = {
    id: newId,
    quartel_id,
    codigo: existingIndex > -1 ? mockOcorrencias[existingIndex].codigo : finalCode,
    tipo,
    endereco,
    viatura_id,
    status: status || "Ativa",
    criado_em: startTime,
    fechado_em: fechado_em || null,
    historico
  };

  if (existingIndex > -1) {
    mockOcorrencias[existingIndex] = data;
  } else {
    mockOcorrencias.unshift(data);
  }
  res.json(data);
}));

app.put("/api/ocorrencias/:id/fechar", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { historico } = req.body;
  const now = new Date().toISOString();

  const db = requireDb();
  if (db) {
    const updateResult = await runQuery("Erro ao fechar ocorrência.", () => db.query(
      "UPDATE ocorrencias SET status = 'Finalizada', fechado_em = $1, historico = $2 WHERE id = $3",
      [now, historico, id]
    ));
    if (updateResult.rowCount === 0) {
      throw new HttpError(404, "Ocorrência não encontrada.");
    }
    const loaded = await runQuery("Erro ao recarregar ocorrência fechada.", () =>
      db.query("SELECT * FROM ocorrencias WHERE id = $1", [id]));
    return res.json(loaded.rows[0]);
  }

  const index = mockOcorrencias.findIndex(o => o.id === id);
  if (index === -1) {
    throw new HttpError(404, "Ocorrência não encontrada.");
  }
  mockOcorrencias[index].status = "Finalizada";
  mockOcorrencias[index].fechado_em = now;
  if (historico) mockOcorrencias[index].historico = historico;
  res.json(mockOcorrencias[index]);
}));

// 7. Mural de Avisos
app.get("/api/mural", asyncHandler(async (req, res) => {
  const db = requireDb();
  if (!db) return res.json(mockMural);
  const result = await runQuery("Erro ao consultar mural de avisos.", () =>
    db.query("SELECT * FROM mural_avisos ORDER BY criado_em DESC"));
  res.json(result.rows);
}));

app.post("/api/mural", asyncHandler(async (req, res) => {
  requireFields(req.body, ["title", "content"]);
  const { title, content, authorRe, quartelId } = req.body;
  const id = "m_" + Date.now();
  const timestamp = new Date().toISOString();

  const db = requireDb();
  if (db) {
    await runQuery("Erro ao registrar aviso.", () => db.query(
      "INSERT INTO mural_avisos (id, quartel_id, titulo, conteudo, bombeiro_re, criado_em) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, quartelId || "q1", title, content, authorRe || "145.230-1", timestamp]
    ));
    return res.json({ id, quartel_id: quartelId || "q1", titulo: title, conteudo: content, bombeiro_re: authorRe, criado_em: timestamp });
  }

  const post = { id, quartel_id: quartelId || "q1", titulo: title, conteudo: content, bombeiro_re: authorRe || "145.230-1", criado_em: timestamp };
  mockMural.unshift(post);
  res.json(post);
}));

app.delete("/api/mural/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = requireDb();
  if (db) {
    const result = await runQuery("Erro ao deletar aviso.", () =>
      db.query("DELETE FROM mural_avisos WHERE id = $1", [id]));
    return res.json({ success: true, deleted: result.rowCount ?? 0 });
  }
  const before = mockMural.length;
  mockMural = mockMural.filter(m => m.id !== id);
  res.json({ success: true, deleted: before - mockMural.length });
}));

// --- AFASTAMENTOS ENDPOINTS ---
app.get("/api/afastamentos", asyncHandler(async (req, res) => {
  const db = requireDb();
  if (!db) return res.json(mockAfastamentos);
  const result = await runQuery("Erro ao consultar afastamentos.", () =>
    db.query("SELECT * FROM afastamentos ORDER BY data_inicio DESC"));
  res.json(result.rows.map(row => ({
    ...row,
    data_inicio: formatDate(row.data_inicio),
    data_fim: formatDate(row.data_fim)
  })));
}));

app.post("/api/afastamentos", asyncHandler(async (req, res) => {
  requireFields(req.body, ["quartel_id", "bombeiro_id", "data_inicio", "data_fim", "tipo"]);
  const { id, quartel_id, bombeiro_id, data_inicio, data_fim, tipo, justificativa } = req.body;
  const newId = id || "af_" + Date.now();
  const rawStart = formatDate(data_inicio);
  const rawEnd = formatDate(data_fim);
  if (rawEnd < rawStart) {
    throw new HttpError(400, "A data de término do afastamento não pode ser anterior à data de início.");
  }

  const db = requireDb();
  if (db) {
    await runQuery("Erro ao salvar afastamento.", () => db.query(`
      INSERT INTO afastamentos (id, quartel_id, bombeiro_id, data_inicio, data_fim, tipo, justificativa)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        quartel_id = EXCLUDED.quartel_id,
        bombeiro_id = EXCLUDED.bombeiro_id,
        data_inicio = EXCLUDED.data_inicio,
        data_fim = EXCLUDED.data_fim,
        tipo = EXCLUDED.tipo,
        justificativa = EXCLUDED.justificativa
    `, [newId, quartel_id, bombeiro_id, rawStart, rawEnd, tipo, justificativa]));
    return res.json({ id: newId, quartel_id, bombeiro_id, data_inicio: rawStart, data_fim: rawEnd, tipo, justificativa });
  }

  // Fallback Local Cache
  const existingIndex = mockAfastamentos.findIndex(af => af.id === newId);
  const dataset = { id: newId, quartel_id, bombeiro_id, data_inicio: rawStart, data_fim: rawEnd, tipo, justificativa };
  if (existingIndex > -1) {
    mockAfastamentos[existingIndex] = dataset;
  } else {
    mockAfastamentos.push(dataset);
  }
  res.json(dataset);
}));

app.delete("/api/afastamentos/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = requireDb();
  if (db) {
    const result = await runQuery("Erro ao deletar afastamento.", () =>
      db.query("DELETE FROM afastamentos WHERE id = $1", [id]));
    return res.json({ success: true, deleted: result.rowCount ?? 0 });
  }
  const before = mockAfastamentos.length;
  mockAfastamentos = mockAfastamentos.filter(af => af.id !== id);
  res.json({ success: true, deleted: before - mockAfastamentos.length });
}));

// --- FMOS ENDPOINTS ---
app.get("/api/fmos", asyncHandler(async (req, res) => {
  const db = requireDb();
  if (!db) return res.json(mockFmos);
  const result = await runQuery("Erro ao consultar FMOs.", () => db.query("SELECT * FROM fmos ORDER BY data DESC"));
  res.json(result.rows.map(row => ({ ...row, data: formatDate(row.data) })));
}));

app.post("/api/fmos", asyncHandler(async (req, res) => {
  requireFields(req.body, ["quartel_id", "bombeiro_id", "data"]);
  const { id, quartel_id, bombeiro_id, data, justificativa } = req.body;
  const newId = id || "fmo_" + Date.now();
  const rawDate = formatDate(data);

  const db = requireDb();
  if (db) {
    await runQuery("Erro ao salvar FMO.", () => db.query(`
      INSERT INTO fmos (id, quartel_id, bombeiro_id, data, justificativa)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        quartel_id = EXCLUDED.quartel_id,
        bombeiro_id = EXCLUDED.bombeiro_id,
        data = EXCLUDED.data,
        justificativa = EXCLUDED.justificativa
    `, [newId, quartel_id, bombeiro_id, rawDate, justificativa]));
    return res.json({ id: newId, quartel_id, bombeiro_id, data: rawDate, justificativa });
  }

  // Fallback Local Cache
  const existingIndex = mockFmos.findIndex(fmo => fmo.id === newId);
  const dataset = { id: newId, quartel_id, bombeiro_id, data: rawDate, justificativa };
  if (existingIndex > -1) {
    mockFmos[existingIndex] = dataset;
  } else {
    mockFmos.push(dataset);
  }
  res.json(dataset);
}));

app.delete("/api/fmos/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = requireDb();
  if (db) {
    const result = await runQuery("Erro ao deletar FMO.", () =>
      db.query("DELETE FROM fmos WHERE id = $1", [id]));
    return res.json({ success: true, deleted: result.rowCount ?? 0 });
  }
  const before = mockFmos.length;
  mockFmos = mockFmos.filter(fmo => fmo.id !== id);
  res.json({ success: true, deleted: before - mockFmos.length });
}));

// --- ADMINISTRAÇÃO E AUTENTICAÇÃO ---
app.post("/api/admins/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new HttpError(400, "Preencha usuário e senha.");
  }

  const db = requireDb();
  if (db) {
    const result = await runQuery("Erro ao validar credenciais de administrador.", () =>
      db.query("SELECT * FROM administradores WHERE username = $1", [username.toLowerCase().trim()]));
    if (result.rows.length > 0 && result.rows[0].password === password) {
      const admin = result.rows[0];
      return res.json({ success: true, admin: { username: admin.username, nome: admin.nome } });
    }
    throw new HttpError(401, "Credenciais de administrador incorretas.");
  }

  const found = mockAdmins.find(a => a.username.toLowerCase().trim() === username.toLowerCase().trim() && a.password === password);
  if (!found) {
    throw new HttpError(401, "Credenciais de administrador incorretas.");
  }
  res.json({ success: true, admin: { username: found.username, nome: found.nome } });
}));

app.post("/api/admins/register", asyncHandler(async (req, res) => {
  const { username, nome, password } = req.body;
  if (!username || !nome || !password) {
    throw new HttpError(400, "Preencha usuário, nome e senha.");
  }

  const cleanUser = username.toLowerCase().trim();

  const db = requireDb();
  if (db) {
    const exists = await runQuery("Erro ao consultar administradores.", () =>
      db.query("SELECT * FROM administradores WHERE username = $1", [cleanUser]));
    if (exists.rows.length > 0) {
      throw new HttpError(400, "Nome de usuário administrador já cadastrado.");
    }
    await runQuery("Erro ao registrar administrador.", () => db.query(`
      INSERT INTO administradores (username, nome, password)
      VALUES ($1, $2, $3)
    `, [cleanUser, nome, password]));
    return res.json({ success: true, admin: { username: cleanUser, nome } });
  }

  const exists = mockAdmins.find(a => a.username.toLowerCase().trim() === cleanUser);
  if (exists) {
    throw new HttpError(400, "Nome de usuário administrador já cadastrado.");
  }
  mockAdmins.push({ username: cleanUser, nome, password });
  res.json({ success: true, admin: { username: cleanUser, nome } });
}));

app.get("/api/admins", asyncHandler(async (req, res) => {
  const db = requireDb();
  if (!db) {
    return res.json(mockAdmins.map(a => ({ username: a.username, nome: a.nome, criado_em: new Date().toISOString() })));
  }
  const result = await runQuery("Erro ao consultar administradores.", () =>
    db.query("SELECT username, nome, criado_em FROM administradores ORDER BY nome"));
  res.json(result.rows);
}));


// Configurar o Vite no Desenvolvimento
async function run() {
  // Rotas de API inexistentes precisam responder JSON antes do fallback SPA,
  // que de outra forma devolveria o index.html com status 200.
  app.use("/api", (req, res) => {
    res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.originalUrl}` });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      res.sendFile(path.join(distPath, "index.html"), err => {
        if (err) next(err);
      });
    });
  }

  // Handler central de erros: registra o erro completo e devolve status/mensagem úteis
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    const isMalformedJson = err instanceof SyntaxError && "body" in err;
    const status = err instanceof HttpError ? err.status : (isMalformedJson ? 400 : 500);
    console.error(`[API ${status}] ${req.method} ${req.originalUrl}:`, err);

    if (res.headersSent) {
      return next(err);
    }

    const message = err instanceof HttpError
      ? err.message
      : (isMalformedJson ? "JSON inválido no corpo da requisição." : "Erro interno no servidor.");
    const details = describeError(err);

    res.status(status).json(details === message ? { error: message } : { error: message, details });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor de Gestão Firefighter rodando em http://0.0.0.0:${PORT}`);
  });
}

run().catch(err => {
  console.error("Falha fatal ao iniciar o servidor:", err);
  process.exit(1);
});

process.on("unhandledRejection", reason => {
  console.error("Rejeição de Promise não tratada:", reason);
});

process.on("uncaughtException", err => {
  console.error("Exceção não capturada, encerrando o processo:", err);
  process.exit(1);
});
