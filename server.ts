import crypto from "node:crypto";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

const dbUrl = process.env.SUPABASE_DB_URL;

let pool: pg.Pool | null = null;
let isDbConnected = false;

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

// --- SENHAS (scrypt com salt aleatório) ---
const SCRYPT_KEYLEN = 64;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  if (typeof stored !== "string") return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
    actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  } catch {
    return false;
  }
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function isHashedPassword(stored: unknown): boolean {
  return typeof stored === "string" && stored.startsWith("scrypt$");
}

// A senha inicial vem do ambiente; sem ela uma senha aleatória é gerada e
// exibida uma única vez no log do servidor.
let defaultAdminPassword: string | null = null;

function resolveDefaultAdminPassword(): string {
  if (defaultAdminPassword) return defaultAdminPassword;
  defaultAdminPassword = generateDefaultAdminPassword();
  return defaultAdminPassword;
}

function generateDefaultAdminPassword(): string {
  const fromEnv = process.env.ADMIN_DEFAULT_PASSWORD;
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  if (fromEnv) {
    console.warn("ADMIN_DEFAULT_PASSWORD tem menos de 8 caracteres e foi ignorada.");
  }
  const generated = crypto.randomBytes(12).toString("base64url");
  console.warn(`Senha inicial do administrador 'admin' gerada: ${generated}`);
  console.warn("Defina ADMIN_DEFAULT_PASSWORD e troque esta senha após o primeiro acesso.");
  return generated;
}

let mockAdmins: { username: string; nome: string; password: string }[] = [];

function ensureMockAdmin() {
  if (mockAdmins.length > 0) return;
  mockAdmins.push({
    username: "admin",
    nome: "Administrador 20º GB",
    password: hashPassword(resolveDefaultAdminPassword())
  });
  console.log("Administrador padrão ('admin') criado no modo Em Memória.");
}

// --- SESSÕES ADMINISTRATIVAS ---
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type AdminIdentity = { username: string; nome: string };
type AdminSession = AdminIdentity & { expiresAt: number };

const sessions = new Map<string, AdminSession>();

function createSession(admin: AdminIdentity): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { ...admin, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function readSession(req: express.Request): AdminSession | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!readSession(req)) {
    return res.status(401).json({ error: "Autenticação de administrador obrigatória." });
  }
  next();
}

// --- RATE LIMIT DO LOGIN ---
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

// --- VALIDAÇÃO DE ENTRADA ---
const ID_PATTERN = /^[A-Za-z0-9_.-]{1,50}$/;

function text(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return undefined;
  return trimmed;
}

function optionalText(value: unknown, maxLen: number): string | undefined {
  if (value === undefined || value === null || value === "") return "";
  return text(value, maxLen);
}

function identifier(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return ID_PATTERN.test(trimmed) ? trimmed : undefined;
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().split("T")[0];
}

function isoTimestamp(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function badRequest(res: express.Response, field: string) {
  return res.status(400).json({ error: `Campo inválido ou ausente: ${field}` });
}

function paramId(req: express.Request, res: express.Response): string | null {
  const id = identifier(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identificador inválido." });
    return null;
  }
  return id;
}

// Iniciar conexão com Supabase Postgres
async function initDb() {
  console.log("Tentando conectar com o banco Supabase PostgreSQL...");
  
  if (!dbUrl) {
    console.warn("Nenhuma URL de banco de dados fornecida. Usando modo Em Memória.");
    return false;
  }

  try {
    pool = new pg.Pool({
      connectionString: dbUrl,
      // Supabase exige SSL; a verificação do certificado só é desligada por opt-in explícito.
      ssl: { rejectUnauthorized: process.env.DB_SSL_NO_VERIFY !== "true" }
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
      `, ["admin", "Administrador 20º GB", hashPassword(resolveDefaultAdminPassword())]);
      console.log("Administrador padrão ('admin') semeado com sucesso.");
    }

    // Migrar senhas legadas armazenadas em texto puro
    const storedAdmins = await pool.query("SELECT username, password FROM administradores");
    for (const admin of storedAdmins.rows) {
      if (!isHashedPassword(admin.password)) {
        await pool.query("UPDATE administradores SET password = $1 WHERE username = $2", [hashPassword(admin.password), admin.username]);
        console.log(`Senha do administrador '${admin.username}' migrada para hash scrypt.`);
      }
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
    return false;
  }
}

initDb().then((connected) => {
  if (!connected) ensureMockAdmin();
});

// --- ENDPOINTS DA API ---

// 1. Status Connection
app.get("/api/status", (req, res) => {
  res.json({
    connected: isDbConnected,
    database: isDbConnected ? "PostgreSQL - Supabase" : "In-Memory Fallback",
    time: new Date().toISOString()
  });
});

// 2. Quarteis (Unidades)
app.get("/api/quarteis", async (req, res) => {
  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT * FROM quarteis ORDER BY nome");
      return res.json(result.rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockQuarteis);
});

// 3. Bombeiros (Efetivo)
app.get("/api/bombeiros", async (req, res) => {
  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT * FROM bombeiros ORDER BY posto_grad ASC, nome ASC");
      return res.json(result.rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockBombeiros);
});

app.post("/api/bombeiros", requireAdmin, async (req, res) => {
  const newId = req.body.id === undefined || req.body.id === null || req.body.id === ""
    ? "b_" + Date.now()
    : identifier(req.body.id);
  if (!newId) return badRequest(res, "id");

  const quartel_id = identifier(req.body.quartel_id);
  if (!quartel_id) return badRequest(res, "quartel_id");
  const nome = text(req.body.nome, 100);
  if (!nome) return badRequest(res, "nome");
  const nome_guerra = text(req.body.nome_guerra, 50);
  if (!nome_guerra) return badRequest(res, "nome_guerra");
  const re = text(req.body.re, 20);
  if (!re) return badRequest(res, "re");
  const posto_grad = text(req.body.posto_grad, 30);
  if (!posto_grad) return badRequest(res, "posto_grad");
  const status = optionalText(req.body.status, 20);
  if (status === undefined) return badRequest(res, "status");
  const telefone = optionalText(req.body.telefone, 20);
  if (telefone === undefined) return badRequest(res, "telefone");
  const especialidades = optionalText(req.body.especialidades, 500);
  if (especialidades === undefined) return badRequest(res, "especialidades");
  const data_inicio_servico = optionalText(req.body.data_inicio_servico, 20);
  if (data_inicio_servico === undefined) return badRequest(res, "data_inicio_servico");
  const regime = optionalText(req.body.regime, 30);
  if (regime === undefined) return badRequest(res, "regime");
  const equipe = optionalText(req.body.equipe, 30);
  if (equipe === undefined) return badRequest(res, "equipe");

  if (isDbConnected && pool) {
    try {
      await pool.query(`
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
      `, [newId, quartel_id, nome, nome_guerra, re, posto_grad, status || "Ativo", telefone, especialidades, data_inicio_servico, regime || "PRONTIDÃO", equipe || ""]);
      
      const updated = await pool.query("SELECT * FROM bombeiros WHERE id = $1", [newId]);
      return res.json(updated.rows[0]);
    } catch (e) {
      console.error("Erro ao salvar bombeiro:", e);
      return res.status(500).json({ error: "Erro ao salvar bombeiro" });
    }
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
});

app.delete("/api/bombeiros/:id", requireAdmin, async (req, res) => {
  const id = paramId(req, res);
  if (!id) return;
  if (isDbConnected && pool) {
    try {
      await pool.query("DELETE FROM bombeiros WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao deletar" });
    }
  }
  mockBombeiros = mockBombeiros.filter(b => b.id !== id);
  res.json({ success: true });
});

// 4. Escalas de Plantão (Shifts)
app.get("/api/escalas", async (req, res) => {
  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT * FROM escalas ORDER BY data DESC");
      // Map postgres date properly (strip timestamp text)
      const mapped = result.rows.map(row => ({
        ...row,
        data: formatDate(row.data)
      }));
      return res.json(mapped);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockEscalas);
});

app.post("/api/escalas", requireAdmin, async (req, res) => {
  const newId = req.body.id === undefined || req.body.id === null || req.body.id === ""
    ? "e_" + Date.now()
    : identifier(req.body.id);
  if (!newId) return badRequest(res, "id");

  const quartel_id = identifier(req.body.quartel_id);
  if (!quartel_id) return badRequest(res, "quartel_id");
  const bombeiro_id = identifier(req.body.bombeiro_id);
  if (!bombeiro_id) return badRequest(res, "bombeiro_id");
  const funcao = text(req.body.funcao, 100);
  if (!funcao) return badRequest(res, "funcao");
  const periodo = text(req.body.periodo, 30);
  if (!periodo) return badRequest(res, "periodo");
  const rawDate = isoDate(req.body.data);
  if (!rawDate) return badRequest(res, "data");

  if (isDbConnected && pool) {
    try {
      await pool.query(`
        INSERT INTO escalas (id, quartel_id, data, bombeiro_id, funcao, periodo)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          quartel_id = EXCLUDED.quartel_id,
          data = EXCLUDED.data,
          bombeiro_id = EXCLUDED.bombeiro_id,
          funcao = EXCLUDED.funcao,
          periodo = EXCLUDED.periodo
      `, [newId, quartel_id, rawDate, bombeiro_id, funcao, periodo]);
      return res.json({ id: newId, quartel_id, data: rawDate, bombeiro_id, funcao, periodo });
    } catch (e) {
      console.error("Erro ao salvar escala:", e);
      return res.status(500).json({ error: "Erro ao salvar escala" });
    }
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
});

app.delete("/api/escalas/:id", requireAdmin, async (req, res) => {
  const id = paramId(req, res);
  if (!id) return;
  if (isDbConnected && pool) {
    try {
      await pool.query("DELETE FROM escalas WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao deletar" });
    }
  }
  mockEscalas = mockEscalas.filter(e => e.id !== id);
  res.json({ success: true });
});

// 5. Viaturas (Fleet)
app.get("/api/viaturas", async (req, res) => {
  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT * FROM viaturas ORDER BY codigo");
      return res.json(result.rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockViaturas);
});

app.put("/api/viaturas/:id", requireAdmin, async (req, res) => {
  const id = paramId(req, res);
  if (!id) return;
  const status = text(req.body.status, 30);
  if (!status) return badRequest(res, "status");
  const escala_atual = optionalText(req.body.escala_atual, 500);
  if (escala_atual === undefined) return badRequest(res, "escala_atual");

  if (isDbConnected && pool) {
    try {
      await pool.query(
        "UPDATE viaturas SET status = $1, escala_atual = $2 WHERE id = $3",
        [status, escala_atual, id]
      );
      const updated = await pool.query("SELECT * FROM viaturas WHERE id = $1", [id]);
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
app.get("/api/ocorrencias", async (req, res) => {
  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT * FROM ocorrencias ORDER BY criado_em DESC");
      return res.json(result.rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockOcorrencias);
});

app.post("/api/ocorrencias", requireAdmin, async (req, res) => {
  const newId = req.body.id === undefined || req.body.id === null || req.body.id === ""
    ? "o_" + Date.now()
    : identifier(req.body.id);
  if (!newId) return badRequest(res, "id");

  const quartel_id = identifier(req.body.quartel_id);
  if (!quartel_id) return badRequest(res, "quartel_id");
  const tipo = text(req.body.tipo, 100);
  if (!tipo) return badRequest(res, "tipo");
  const endereco = text(req.body.endereco, 200);
  if (!endereco) return badRequest(res, "endereco");
  const viatura_id = req.body.viatura_id === undefined || req.body.viatura_id === null || req.body.viatura_id === ""
    ? null
    : identifier(req.body.viatura_id);
  if (viatura_id === undefined) return badRequest(res, "viatura_id");
  const status = optionalText(req.body.status, 20);
  if (status === undefined) return badRequest(res, "status");
  const historico = optionalText(req.body.historico, 5000);
  if (historico === undefined) return badRequest(res, "historico");
  const criadoEm = isoTimestamp(req.body.criado_em);
  if (criadoEm === undefined) return badRequest(res, "criado_em");
  const fechadoEm = isoTimestamp(req.body.fechado_em);
  if (fechadoEm === undefined) return badRequest(res, "fechado_em");

  const fechado_em = fechadoEm || null;
  const finalCode = "OCO-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900);
  const startTime = criadoEm || new Date().toISOString();

  if (isDbConnected && pool) {
    try {
      await pool.query(`
        INSERT INTO ocorrencias (id, quartel_id, codigo, tipo, endereco, viatura_id, status, criado_em, fechado_em, historico)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          tipo = EXCLUDED.tipo,
          endereco = EXCLUDED.endereco,
          viatura_id = EXCLUDED.viatura_id,
          status = EXCLUDED.status,
          fechado_em = EXCLUDED.fechado_em,
          historico = EXCLUDED.historico
      `, [newId, quartel_id, finalCode, tipo, endereco, viatura_id, status || "Ativa", startTime, fechado_em, historico]);
      
      const loaded = await pool.query("SELECT * FROM ocorrencias WHERE id = $1", [newId]);
      return res.json(loaded.rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao registrar ocorrência" });
    }
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
});

app.put("/api/ocorrencias/:id/fechar", requireAdmin, async (req, res) => {
  const id = paramId(req, res);
  if (!id) return;
  const historico = optionalText(req.body.historico, 5000);
  if (historico === undefined) return badRequest(res, "historico");
  const now = new Date().toISOString();

  if (isDbConnected && pool) {
    try {
      await pool.query(
        "UPDATE ocorrencias SET status = 'Finalizada', fechado_em = $1, historico = $2 WHERE id = $3",
        [now, historico, id]
      );
      const loaded = await pool.query("SELECT * FROM ocorrencias WHERE id = $1", [id]);
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
app.get("/api/mural", async (req, res) => {
  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT * FROM mural_avisos ORDER BY criado_em DESC");
      return res.json(result.rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockMural);
});

app.post("/api/mural", requireAdmin, async (req, res) => {
  const title = text(req.body.title, 100);
  if (!title) return badRequest(res, "title");
  const content = text(req.body.content, 5000);
  if (!content) return badRequest(res, "content");
  const authorRe = optionalText(req.body.authorRe, 50);
  if (authorRe === undefined) return badRequest(res, "authorRe");
  const quartelId = identifier(req.body.quartelId);
  if (!quartelId) return badRequest(res, "quartelId");
  const id = "m_" + Date.now();
  const timestamp = new Date().toISOString();

  if (isDbConnected && pool) {
    try {
      await pool.query(
        "INSERT INTO mural_avisos (id, quartel_id, titulo, conteudo, bombeiro_re, criado_em) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, quartelId, title, content, authorRe, timestamp]
      );
      return res.json({ id, quartel_id: quartelId, titulo: title, conteudo: content, bombeiro_re: authorRe, criado_em: timestamp });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao registrar aviso" });
    }
  }

  const post = { id, quartel_id: quartelId, titulo: title, conteudo: content, bombeiro_re: authorRe, criado_em: timestamp };
  mockMural.unshift(post);
  res.json(post);
});

app.delete("/api/mural/:id", requireAdmin, async (req, res) => {
  const id = paramId(req, res);
  if (!id) return;
  if (isDbConnected && pool) {
    try {
      await pool.query("DELETE FROM mural_avisos WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao deletar" });
    }
  }
  mockMural = mockMural.filter(m => m.id !== id);
  res.json({ success: true });
});

// --- AFASTAMENTOS ENDPOINTS ---
app.get("/api/afastamentos", async (req, res) => {
  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT * FROM afastamentos ORDER BY data_inicio DESC");
      const mapped = result.rows.map(row => ({
        ...row,
        data_inicio: formatDate(row.data_inicio),
        data_fim: formatDate(row.data_fim)
      }));
      return res.json(mapped);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockAfastamentos);
});

app.post("/api/afastamentos", requireAdmin, async (req, res) => {
  const newId = req.body.id === undefined || req.body.id === null || req.body.id === ""
    ? "af_" + Date.now()
    : identifier(req.body.id);
  if (!newId) return badRequest(res, "id");

  const quartel_id = identifier(req.body.quartel_id);
  if (!quartel_id) return badRequest(res, "quartel_id");
  const bombeiro_id = identifier(req.body.bombeiro_id);
  if (!bombeiro_id) return badRequest(res, "bombeiro_id");
  const tipo = text(req.body.tipo, 50);
  if (!tipo) return badRequest(res, "tipo");
  const justificativa = optionalText(req.body.justificativa, 250);
  if (justificativa === undefined) return badRequest(res, "justificativa");
  const rawStart = isoDate(req.body.data_inicio);
  if (!rawStart) return badRequest(res, "data_inicio");
  const rawEnd = isoDate(req.body.data_fim);
  if (!rawEnd) return badRequest(res, "data_fim");

  if (isDbConnected && pool) {
    try {
      await pool.query(`
        INSERT INTO afastamentos (id, quartel_id, bombeiro_id, data_inicio, data_fim, tipo, justificativa)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          quartel_id = EXCLUDED.quartel_id,
          bombeiro_id = EXCLUDED.bombeiro_id,
          data_inicio = EXCLUDED.data_inicio,
          data_fim = EXCLUDED.data_fim,
          tipo = EXCLUDED.tipo,
          justificativa = EXCLUDED.justificativa
      `, [newId, quartel_id, bombeiro_id, rawStart, rawEnd, tipo, justificativa]);
      return res.json({ id: newId, quartel_id, bombeiro_id, data_inicio: rawStart, data_fim: rawEnd, tipo, justificativa });
    } catch (e) {
      console.error("Erro ao salvar afastamento:", e);
      return res.status(500).json({ error: "Erro ao salvar afastamento" });
    }
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
});

app.delete("/api/afastamentos/:id", requireAdmin, async (req, res) => {
  const id = paramId(req, res);
  if (!id) return;
  if (isDbConnected && pool) {
    try {
      await pool.query("DELETE FROM afastamentos WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao deletar afastamento" });
    }
  }
  mockAfastamentos = mockAfastamentos.filter(af => af.id !== id);
  res.json({ success: true });
});

// --- FMOS ENDPOINTS ---
app.get("/api/fmos", async (req, res) => {
  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT * FROM fmos ORDER BY data DESC");
      const mapped = result.rows.map(row => ({
        ...row,
        data: formatDate(row.data)
      }));
      return res.json(mapped);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockFmos);
});

app.post("/api/fmos", requireAdmin, async (req, res) => {
  const newId = req.body.id === undefined || req.body.id === null || req.body.id === ""
    ? "fmo_" + Date.now()
    : identifier(req.body.id);
  if (!newId) return badRequest(res, "id");

  const quartel_id = identifier(req.body.quartel_id);
  if (!quartel_id) return badRequest(res, "quartel_id");
  const bombeiro_id = identifier(req.body.bombeiro_id);
  if (!bombeiro_id) return badRequest(res, "bombeiro_id");
  const justificativa = optionalText(req.body.justificativa, 250);
  if (justificativa === undefined) return badRequest(res, "justificativa");
  const rawDate = isoDate(req.body.data);
  if (!rawDate) return badRequest(res, "data");

  if (isDbConnected && pool) {
    try {
      await pool.query(`
        INSERT INTO fmos (id, quartel_id, bombeiro_id, data, justificativa)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          quartel_id = EXCLUDED.quartel_id,
          bombeiro_id = EXCLUDED.bombeiro_id,
          data = EXCLUDED.data,
          justificativa = EXCLUDED.justificativa
      `, [newId, quartel_id, bombeiro_id, rawDate, justificativa]);
      return res.json({ id: newId, quartel_id, bombeiro_id, data: rawDate, justificativa });
    } catch (e) {
      console.error("Erro ao salvar FMO:", e);
      return res.status(500).json({ error: "Erro ao salvar FMO" });
    }
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
});

app.delete("/api/fmos/:id", requireAdmin, async (req, res) => {
  const id = paramId(req, res);
  if (!id) return;
  if (isDbConnected && pool) {
    try {
      await pool.query("DELETE FROM fmos WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao deletar FMO" });
    }
  }
  mockFmos = mockFmos.filter(fmo => fmo.id !== id);
  res.json({ success: true });
});



// --- ADMINISTRAÇÃO E AUTENTICAÇÃO ---
app.post("/api/admins/login", async (req, res) => {
  if (isLoginRateLimited(req.ip || "unknown")) {
    return res.status(429).json({ error: "Muitas tentativas de login. Tente novamente mais tarde." });
  }

  const username = text(req.body.username, 50);
  const password = text(req.body.password, 200);
  if (!username || !password) {
    return res.status(400).json({ error: "Preencha usuário e senha." });
  }

  const cleanUser = username.toLowerCase();

  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT username, nome, password FROM administradores WHERE username = $1", [cleanUser]);
      if (result.rows.length > 0 && verifyPassword(password, result.rows[0].password)) {
        const admin = { username: result.rows[0].username, nome: result.rows[0].nome };
        return res.json({ success: true, admin, token: createSession(admin) });
      }
      return res.status(401).json({ error: "Credenciais de administrador incorretas." });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro interno no servidor." });
    }
  }

  const found = mockAdmins.find(a => a.username === cleanUser);
  if (found && verifyPassword(password, found.password)) {
    const admin = { username: found.username, nome: found.nome };
    return res.json({ success: true, admin, token: createSession(admin) });
  }
  return res.status(401).json({ error: "Credenciais de administrador incorretas." });
});

app.get("/api/admins/session", requireAdmin, (req, res) => {
  const session = readSession(req)!;
  res.json({ success: true, admin: { username: session.username, nome: session.nome } });
});

app.post("/api/admins/logout", requireAdmin, (req, res) => {
  const token = (req.headers.authorization || "").slice("Bearer ".length).trim();
  sessions.delete(token);
  res.json({ success: true });
});

app.post("/api/admins/register", requireAdmin, async (req, res) => {
  const username = text(req.body.username, 50);
  const nome = text(req.body.nome, 100);
  const password = text(req.body.password, 200);
  if (!username || !nome || !password) {
    return res.status(400).json({ error: "Preencha usuário, nome e senha." });
  }
  if (!/^[a-z0-9_.-]+$/i.test(username)) {
    return res.status(400).json({ error: "Usuário deve conter apenas letras, números, ponto, hífen ou sublinhado." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "A senha deve ter ao menos 8 caracteres." });
  }

  const cleanUser = username.toLowerCase();

  if (isDbConnected && pool) {
    try {
      const exists = await pool.query("SELECT * FROM administradores WHERE username = $1", [cleanUser]);
      if (exists.rows.length > 0) {
        return res.status(400).json({ error: "Nome de usuário administrador já cadastrado." });
      }
      await pool.query(`
        INSERT INTO administradores (username, nome, password) 
        VALUES ($1, $2, $3)
      `, [cleanUser, nome, hashPassword(password)]);
      return res.json({ success: true, admin: { username: cleanUser, nome } });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erro ao registrar administrador." });
    }
  }

  const exists = mockAdmins.find(a => a.username === cleanUser);
  if (exists) {
    return res.status(400).json({ error: "Nome de usuário administrador já cadastrado." });
  }
  mockAdmins.push({ username: cleanUser, nome, password: hashPassword(password) });
  res.json({ success: true, admin: { username: cleanUser, nome } });
});

app.get("/api/admins", requireAdmin, async (req, res) => {
  if (isDbConnected && pool) {
    try {
      const result = await pool.query("SELECT username, nome, criado_em FROM administradores ORDER BY nome");
      return res.json(result.rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockAdmins.map(a => ({ username: a.username, nome: a.nome, criado_em: new Date().toISOString() })));
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
