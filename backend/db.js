const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err.message);
});

// Test connection on startup
async function connect() {
  const client = await pool.connect();
  console.log('✅  PostgreSQL connecté');
  client.release();
}

// Helper: run a query and return all rows
async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

// Helper: return first row or null
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// Helper: INSERT and return the new row
async function insert(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0];
}

// Helper: run UPDATE/DELETE
async function exec(sql, params = []) {
  await pool.query(sql, params);
}

// Initialise schema (CREATE TABLE IF NOT EXISTS)
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      username    TEXT    NOT NULL UNIQUE,
      email       TEXT    NOT NULL UNIQUE,
      full_name   TEXT    NOT NULL,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'user',
      status      TEXT    NOT NULL DEFAULT 'pending',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS exams (
      id               SERIAL PRIMARY KEY,
      name             TEXT    NOT NULL,
      description      TEXT    DEFAULT '',
      duration_minutes INTEGER,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS questions (
      id              SERIAL PRIMARY KEY,
      exam_id         INTEGER NOT NULL REFERENCES exams(id),
      question_num    INTEGER NOT NULL DEFAULT 0,
      question_text   TEXT    NOT NULL,
      question_type   TEXT    NOT NULL DEFAULT 'single',
      correct_letter  TEXT    NOT NULL DEFAULT '',
      correct_text    TEXT    DEFAULT '',
      explanation     TEXT    DEFAULT '',
      is_multi_select BOOLEAN DEFAULT FALSE,
      playable        BOOLEAN NOT NULL DEFAULT TRUE  -- false = données incomplètes (exclue des quiz)
    );

    CREATE TABLE IF NOT EXISTS options (
      id          SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES questions(id),
      letter      TEXT    NOT NULL,
      option_text TEXT    NOT NULL,
      is_correct  BOOLEAN NOT NULL DEFAULT FALSE
    );

    -- Paires d'appariement (questions 'match') — infra prête pour activation future
    CREATE TABLE IF NOT EXISTS match_pairs (
      id          SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES questions(id),
      left_text   TEXT    NOT NULL,
      right_text  TEXT    NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      exam_id         INTEGER NOT NULL REFERENCES exams(id),
      candidate_name  TEXT    NOT NULL,
      question_count  INTEGER NOT NULL DEFAULT 0,
      shuffled        BOOLEAN DEFAULT FALSE,
      started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at        TIMESTAMPTZ,
      time_limit_seconds INTEGER,
      score_correct      INTEGER DEFAULT 0,
      score_total        INTEGER DEFAULT 0,
      status             TEXT    NOT NULL DEFAULT 'in_progress'
    );

    CREATE TABLE IF NOT EXISTS attempt_answers (
      id              SERIAL PRIMARY KEY,
      attempt_id      INTEGER NOT NULL REFERENCES attempts(id),
      question_id     INTEGER NOT NULL REFERENCES questions(id),
      selected_letter TEXT,
      answer_data     JSONB,   -- réponse brute pour multi (lettres) / match (paires)
      is_correct      BOOLEAN DEFAULT FALSE
    );

    -- Migrations idempotentes (bases déjà créées avant ces colonnes)
    ALTER TABLE exams          ADD COLUMN IF NOT EXISTS duration_minutes   INTEGER;
    ALTER TABLE questions      ADD COLUMN IF NOT EXISTS question_type      TEXT NOT NULL DEFAULT 'single';
    ALTER TABLE questions      ADD COLUMN IF NOT EXISTS playable           BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE options        ADD COLUMN IF NOT EXISTS is_correct         BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE attempts       ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER;
    ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS answer_data       JSONB;

    CREATE INDEX IF NOT EXISTS idx_questions_exam    ON questions(exam_id);
    CREATE INDEX IF NOT EXISTS idx_questions_type    ON questions(question_type);
    CREATE INDEX IF NOT EXISTS idx_questions_play     ON questions(exam_id, playable);
    CREATE INDEX IF NOT EXISTS idx_options_question  ON options(question_id);
    CREATE INDEX IF NOT EXISTS idx_matchpairs_q      ON match_pairs(question_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_user     ON attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_exam     ON attempts(exam_id);
    CREATE INDEX IF NOT EXISTS idx_answers_attempt   ON attempt_answers(attempt_id);
  `);
  console.log('✅  Schéma PostgreSQL initialisé');
}

module.exports = { pool, connect, query, queryOne, insert, exec, initSchema };
