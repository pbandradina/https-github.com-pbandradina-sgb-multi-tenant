import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import dotenv from "dotenv";
import { toDateKey } from "./src/lib/dates";
import {
  ActivePool,
  buildInsert,
  buildUpsert,
  respondWithDelete,
  respondWithRows,
  upsertCacheItem,
  valuesOf
} from "./src/server/dbFallback";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const dbUrl = process.env.SUPABASE_DB_URL;

let pool: pg.Pool | null = null;
let isDbConnected = false;
let dbConnectionStringRef = "";

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

let mockEscalas = [
  { id: "e1", quartel_id: "q1", data: toDateKey(new Date()), bombeiro_id: "b3", funcao: "Chefe de Guarnição / Comandante", periodo: "24h" },
  { id: "e2", quartel_id: "q1", data: toDateKey(new Date()), bombeiro_id: "b4", funcao: "Motorista da Auto Bomba (ABS)", periodo: "24h" },
  { id: "e3", quartel_id: "q1", data: toDateKey(new Date()), bombeiro_id: "b5", funcao: "Socorrista da Unidade de Resgate (UR)", periodo: "24h" },
  { id: "e4", quartel_id: "q1", data: toDateKey(new Date()), bombeiro_id: "b6", funcao: "Auxiliar de Combate", periodo: "24h" },
  { id: "e5", quartel_id: "q1", data: toDateKey(new Date()), bombeiro_id: "b7", funcao: "Operador de Telecomunicações", periodo: "24h" }
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

// Column order shared by the generated INSERT/UPSERT statements and the seeding routine
const COLUNAS_QUARTEIS = ["id", "nome", "cidade", "subgrupamento"];
const COLUNAS_BOMBEIROS = ["id", "quartel_id", "nome", "nome_guerra", "re", "posto_grad", "status", "telefone", "especialidades", "data_inicio_servico", "regime", "equipe"];
const COLUNAS_ESCALAS = ["id", "quartel_id", "data", "bombeiro_id", "funcao", "periodo"];
const COLUNAS_VIATURAS = ["id", "quartel_id", "codigo", "tipo", "status", "escala_atual"];
const COLUNAS_OCORRENCIAS = ["id", "quartel_id", "codigo", "tipo", "endereco", "viatura_id", "status", "criado_em", "fechado_em", "historico"];
const COLUNAS_MURAL = ["id", "quartel_id", "titulo", "conteudo", "bombeiro_re", "criado_em"];
const COLUNAS_AFASTAMENTOS = ["id", "quartel_id", "bombeiro_id", "data_inicio", "data_fim", "tipo", "justificativa"];
const COLUNAS_FMOS = ["id", "quartel_id", "bombeiro_id", "data", "justificativa"];

// Pool only while the database is really reachable; null routes the request to the in-memory cache
const activePool = (): ActivePool => (isDbConnected && pool ? pool : null);

const normalizeUsername = (username: string) => username.toLowerCase().trim();

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
    const seedRows = async (table: string, columns: string[], rows: Record<string, unknown>[], sql?: string) => {
      const statement = sql || buildInsert(table, columns);
      for (const row of rows) {
        await pool!.query(statement, valuesOf(columns, row));
      }
    };

    await seedRows("quarteis", COLUNAS_QUARTEIS, mockQuarteis, buildUpsert("quarteis", COLUNAS_QUARTEIS));
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
      await seedRows("bombeiros", COLUNAS_BOMBEIROS, mockBombeiros);
      await seedRows("escalas", COLUNAS_ESCALAS, mockEscalas);
      await seedRows("viaturas", COLUNAS_VIATURAS, mockViaturas);
      await seedRows("ocorrencias", COLUNAS_OCORRENCIAS, mockOcorrencias);
      await seedRows("mural_avisos", COLUNAS_MURAL, mockMural);
      await seedRows("afastamentos", COLUNAS_AFASTAMENTOS, mockAfastamentos);
      await seedRows("fmos", COLUNAS_FMOS, mockFmos);
      console.log("Dados iniciais semeados com sucesso.");
    }
    
    return true;
  } catch (err) {
    console.error("Erro ao conectar ou configurar o PostgreSQL do Supabase:", err);
    console.warn("Utilizando persistência Em Memória temporária para manter a aplicação 100% ativa!");
    isDbConnected = false;
    return false;
  }
}

initDb();

// --- ENDPOINTS DA API ---

// 1. Status Connection
app.get("/api/status", (req, res) => {
  res.json({
    connected: isDbConnected,
    database: "PostgreSQL - Supabase",
    connectionString: dbConnectionStringRef || "In-Memory Fallback Client",
    time: new Date().toISOString()
  });
});

// 2. Quarteis (Unidades)
app.get("/api/quarteis", (req, res) => {
  respondWithRows(res, activePool(), "SELECT * FROM quarteis ORDER BY nome", mockQuarteis);
});

// 3. Bombeiros (Efetivo)
app.get("/api/bombeiros", (req, res) => {
  respondWithRows(res, activePool(), "SELECT * FROM bombeiros ORDER BY posto_grad ASC, nome ASC", mockBombeiros);
});

app.post("/api/bombeiros", async (req, res) => {
  const { id, quartel_id, nome, nome_guerra, re, posto_grad, status, telefone, especialidades, data_inicio_servico, regime, equipe } = req.body;
  const data = {
    id: id || "b_" + Date.now(),
    quartel_id,
    nome,
    nome_guerra,
    re,
    posto_grad,
    status: status || "Ativo",
    telefone,
    especialidades,
    data_inicio_servico,
    regime: regime || "PRONTIDÃO",
    equipe: equipe || ""
  };
  const db = activePool();

  if (db) {
    try {
      await db.query(buildUpsert("bombeiros", COLUNAS_BOMBEIROS), valuesOf(COLUNAS_BOMBEIROS, data));
      const updated = await db.query("SELECT * FROM bombeiros WHERE id = $1", [data.id]);
      return res.json(updated.rows[0]);
    } catch (e) {
      console.error("Erro ao salvar bombeiro:", e);
      return res.status(500).json({ error: "Erro ao salvar bombeiro" });
    }
  }

  res.json(upsertCacheItem(mockBombeiros, data));
});

app.delete("/api/bombeiros/:id", (req, res) => {
  const { id } = req.params;
  respondWithDelete(res, activePool(), "bombeiros", id, () => {
    mockBombeiros = mockBombeiros.filter(b => b.id !== id);
  });
});

// 4. Escalas de Plantão (Shifts)
app.get("/api/escalas", (req, res) => {
  // Map postgres date properly (strip timestamp text)
  respondWithRows(res, activePool(), "SELECT * FROM escalas ORDER BY data DESC", mockEscalas, row => ({
    ...row,
    data: toDateKey(row.data as string)
  }));
});

app.post("/api/escalas", async (req, res) => {
  const { id, quartel_id, data, bombeiro_id, funcao, periodo } = req.body;
  const dataset = {
    id: id || "e_" + Date.now(),
    quartel_id,
    data: toDateKey(data),
    bombeiro_id,
    funcao,
    periodo
  };
  const db = activePool();

  if (db) {
    try {
      await db.query(buildUpsert("escalas", COLUNAS_ESCALAS), valuesOf(COLUNAS_ESCALAS, dataset));
      return res.json(dataset);
    } catch (e) {
      console.error("Erro ao salvar escala:", e);
      return res.status(500).json({ error: "Erro ao salvar escala" });
    }
  }

  res.json(upsertCacheItem(mockEscalas, dataset));
});

app.delete("/api/escalas/:id", (req, res) => {
  const { id } = req.params;
  respondWithDelete(res, activePool(), "escalas", id, () => {
    mockEscalas = mockEscalas.filter(e => e.id !== id);
  });
});

// 5. Viaturas (Fleet)
app.get("/api/viaturas", (req, res) => {
  respondWithRows(res, activePool(), "SELECT * FROM viaturas ORDER BY codigo", mockViaturas);
});

app.put("/api/viaturas/:id", async (req, res) => {
  const { id } = req.params;
  const { status, escala_atual } = req.body;
  const db = activePool();

  if (db) {
    try {
      await db.query(
        "UPDATE viaturas SET status = $1, escala_atual = $2 WHERE id = $3",
        [status, escala_atual, id]
      );
      const updated = await db.query("SELECT * FROM viaturas WHERE id = $1", [id]);
      return res.json(updated.rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao atualizar viatura" });
    }
  }

  const index = mockViaturas.findIndex(v => v.id === id);
  if (index > -1) {
    mockViaturas[index] = { ...mockViaturas[index], status, escala_atual };
    return res.json(mockViaturas[index]);
  }
  res.status(404).json({ error: "Viatura não encontrada" });
});

// 6. Ocorrências (Dispatches)
app.get("/api/ocorrencias", (req, res) => {
  respondWithRows(res, activePool(), "SELECT * FROM ocorrencias ORDER BY criado_em DESC", mockOcorrencias);
});

app.post("/api/ocorrencias", async (req, res) => {
  const { id, quartel_id, tipo, endereco, viatura_id, status, historico, criado_em, fechado_em } = req.body;
  const newId = id || "o_" + Date.now();
  const finalCode = "OCO-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900);
  const cached = mockOcorrencias.find(o => o.id === newId);
  const data = {
    id: newId,
    quartel_id,
    codigo: cached ? cached.codigo : finalCode,
    tipo,
    endereco,
    viatura_id,
    status: status || "Ativa",
    criado_em: criado_em || new Date().toISOString(),
    fechado_em: fechado_em || null,
    historico
  };
  const db = activePool();

  if (db) {
    try {
      // Código, quartel e abertura permanecem imutáveis após o registro inicial
      const statement = buildUpsert("ocorrencias", COLUNAS_OCORRENCIAS, {
        updateColumns: ["tipo", "endereco", "viatura_id", "status", "fechado_em", "historico"]
      });
      await db.query(statement, valuesOf(COLUNAS_OCORRENCIAS, { ...data, codigo: finalCode }));
      const loaded = await db.query("SELECT * FROM ocorrencias WHERE id = $1", [newId]);
      return res.json(loaded.rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao registrar ocorrência" });
    }
  }

  res.json(upsertCacheItem(mockOcorrencias, data, "start"));
});

app.put("/api/ocorrencias/:id/fechar", async (req, res) => {
  const { id } = req.params;
  const { historico } = req.body;
  const now = new Date().toISOString();
  const db = activePool();

  if (db) {
    try {
      await db.query(
        "UPDATE ocorrencias SET status = 'Finalizada', fechado_em = $1, historico = $2 WHERE id = $3",
        [now, historico, id]
      );
      const loaded = await db.query("SELECT * FROM ocorrencias WHERE id = $1", [id]);
      return res.json(loaded.rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao fechar ocorrência" });
    }
  }

  const index = mockOcorrencias.findIndex(o => o.id === id);
  if (index > -1) {
    mockOcorrencias[index].status = "Finalizada";
    mockOcorrencias[index].fechado_em = now;
    if (historico) mockOcorrencias[index].historico = historico;
    return res.json(mockOcorrencias[index]);
  }
  res.status(404).json({ error: "Ocorrência não encontrada" });
});

// 7. Mural de Avisos
app.get("/api/mural", (req, res) => {
  respondWithRows(res, activePool(), "SELECT * FROM mural_avisos ORDER BY criado_em DESC", mockMural);
});

app.post("/api/mural", async (req, res) => {
  const { title, content, authorRe, quartelId } = req.body;
  const post = {
    id: "m_" + Date.now(),
    quartel_id: quartelId || "q1",
    titulo: title,
    conteudo: content,
    bombeiro_re: authorRe || "145.230-1",
    criado_em: new Date().toISOString()
  };
  const db = activePool();

  if (db) {
    try {
      await db.query(buildInsert("mural_avisos", COLUNAS_MURAL), valuesOf(COLUNAS_MURAL, post));
      return res.json(post);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao registrar aviso" });
    }
  }

  res.json(upsertCacheItem(mockMural, post, "start"));
});

app.delete("/api/mural/:id", (req, res) => {
  const { id } = req.params;
  respondWithDelete(res, activePool(), "mural_avisos", id, () => {
    mockMural = mockMural.filter(m => m.id !== id);
  });
});

// --- AFASTAMENTOS ENDPOINTS ---
app.get("/api/afastamentos", (req, res) => {
  respondWithRows(res, activePool(), "SELECT * FROM afastamentos ORDER BY data_inicio DESC", mockAfastamentos, row => ({
    ...row,
    data_inicio: toDateKey(row.data_inicio as string),
    data_fim: toDateKey(row.data_fim as string)
  }));
});

app.post("/api/afastamentos", async (req, res) => {
  const { id, quartel_id, bombeiro_id, data_inicio, data_fim, tipo, justificativa } = req.body;
  const dataset = {
    id: id || "af_" + Date.now(),
    quartel_id,
    bombeiro_id,
    data_inicio: toDateKey(data_inicio),
    data_fim: toDateKey(data_fim),
    tipo,
    justificativa
  };
  const db = activePool();

  if (db) {
    try {
      await db.query(buildUpsert("afastamentos", COLUNAS_AFASTAMENTOS), valuesOf(COLUNAS_AFASTAMENTOS, dataset));
      return res.json(dataset);
    } catch (e) {
      console.error("Erro ao salvar afastamento:", e);
      return res.status(500).json({ error: "Erro ao salvar afastamento" });
    }
  }

  res.json(upsertCacheItem(mockAfastamentos, dataset));
});

app.delete("/api/afastamentos/:id", (req, res) => {
  const { id } = req.params;
  respondWithDelete(res, activePool(), "afastamentos", id, () => {
    mockAfastamentos = mockAfastamentos.filter(af => af.id !== id);
  }, "Erro ao deletar afastamento");
});

// --- FMOS ENDPOINTS ---
app.get("/api/fmos", (req, res) => {
  respondWithRows(res, activePool(), "SELECT * FROM fmos ORDER BY data DESC", mockFmos, row => ({
    ...row,
    data: toDateKey(row.data as string)
  }));
});

app.post("/api/fmos", async (req, res) => {
  const { id, quartel_id, bombeiro_id, data, justificativa } = req.body;
  const dataset = {
    id: id || "fmo_" + Date.now(),
    quartel_id,
    bombeiro_id,
    data: toDateKey(data),
    justificativa
  };
  const db = activePool();

  if (db) {
    try {
      await db.query(buildUpsert("fmos", COLUNAS_FMOS), valuesOf(COLUNAS_FMOS, dataset));
      return res.json(dataset);
    } catch (e) {
      console.error("Erro ao salvar FMO:", e);
      return res.status(500).json({ error: "Erro ao salvar FMO" });
    }
  }

  res.json(upsertCacheItem(mockFmos, dataset));
});

app.delete("/api/fmos/:id", (req, res) => {
  const { id } = req.params;
  respondWithDelete(res, activePool(), "fmos", id, () => {
    mockFmos = mockFmos.filter(fmo => fmo.id !== id);
  }, "Erro ao deletar FMO");
});



// --- ADMINISTRAÇÃO E AUTENTICAÇÃO ---
app.post("/api/admins/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Preencha usuário e senha." });
  }

  const db = activePool();

  if (db) {
    try {
      const result = await db.query("SELECT * FROM administradores WHERE username = $1", [normalizeUsername(username)]);
      if (result.rows.length > 0 && result.rows[0].password === password) {
        const admin = result.rows[0];
        return res.json({ success: true, admin: { username: admin.username, nome: admin.nome } });
      }
      return res.status(401).json({ error: "Credenciais de administrador incorretas." });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro interno no servidor." });
    }
  }

  const found = mockAdmins.find(a => normalizeUsername(a.username) === normalizeUsername(username) && a.password === password);
  if (found) {
    return res.json({ success: true, admin: { username: found.username, nome: found.nome } });
  }
  return res.status(401).json({ error: "Credenciais de administrador incorretas." });
});

app.post("/api/admins/register", async (req, res) => {
  const { username, nome, password } = req.body;
  if (!username || !nome || !password) {
    return res.status(400).json({ error: "Preencha usuário, nome e senha." });
  }

  const cleanUser = normalizeUsername(username);
  const db = activePool();

  if (db) {
    try {
      const exists = await db.query("SELECT * FROM administradores WHERE username = $1", [cleanUser]);
      if (exists.rows.length > 0) {
        return res.status(400).json({ error: "Nome de usuário administrador já cadastrado." });
      }
      await db.query(buildInsert("administradores", ["username", "nome", "password"]), [cleanUser, nome, password]);
      return res.json({ success: true, admin: { username: cleanUser, nome } });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao registrar administrador." });
    }
  }

  const exists = mockAdmins.find(a => normalizeUsername(a.username) === cleanUser);
  if (exists) {
    return res.status(400).json({ error: "Nome de usuário administrador já cadastrado." });
  }
  mockAdmins.push({ username: cleanUser, nome, password });
  res.json({ success: true, admin: { username: cleanUser, nome } });
});

app.get("/api/admins", (req, res) => {
  respondWithRows(
    res,
    activePool(),
    "SELECT username, nome, criado_em FROM administradores ORDER BY nome",
    mockAdmins.map(a => ({ username: a.username, nome: a.nome, criado_em: new Date().toISOString() }))
  );
});


// Configurar o Vite no Desenvolvimento
async function run() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor de Gestão Firefighter rodando em http://0.0.0.0:${PORT}`);
  });
}

run();
