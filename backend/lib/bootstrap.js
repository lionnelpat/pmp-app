/**
 * Bootstrap idempotent exécuté au démarrage du serveur.
 *
 *   ensureAdmin() — crée le compte administrateur s'il n'existe pas.
 *                   Identifiants pilotés par les variables d'environnement
 *                   (ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL).
 *
 *   ensureExams() — importe les examens livrés UNIQUEMENT si la base est vide.
 *                   Non destructif : ne touche à rien si des examens existent.
 *
 * Ces deux fonctions garantissent qu'une instance fraîche (ex : conteneur sur
 * le VPS) soit immédiatement utilisable, sans jamais bloquer sur un deadlock
 * « aucun admin pour valider les comptes ».
 */
const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');
const db     = require('../db');
const { queryOne, exec } = db;
const EXAM_FILES = require('./examFiles');

async function ensureAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const existing = await queryOne('SELECT id FROM users WHERE username=$1', [username]);
  if (existing) return;

  const password = process.env.ADMIN_PASSWORD || 'Admin2024!';
  const email    = process.env.ADMIN_EMAIL    || 'admin@pmp.local';
  const hash     = await bcrypt.hash(password, 10);
  await exec(
    `INSERT INTO users (username, email, full_name, password, role, status, approved_at)
     VALUES ($1, $2, 'Administrateur', $3, 'admin', 'active', NOW())`,
    [username, email, hash]
  );
  console.log(`✅  Admin auto-créé  →  ${username}`);
}

async function ensureExams() {
  const row = await queryOne('SELECT COUNT(*)::int AS n FROM exams');
  if (row && row.n > 0) return;                 // déjà peuplé → on ne touche à rien

  const { importExam } = require('./questions');
  const DATA = path.join(__dirname, '..', 'data');
  let imported = 0;
  for (const { file, name, desc } of EXAM_FILES) {
    const full = path.join(DATA, file);
    if (!fs.existsSync(full)) { console.warn(`⚠️   Fichier examen introuvable : ${file}`); continue; }
    const questions = JSON.parse(fs.readFileSync(full, 'utf8'));
    await importExam(db, { name, description: desc }, questions);
    imported++;
  }
  if (imported) console.log(`✅  ${imported} examens importés automatiquement (base vide)`);
}

module.exports = { ensureAdmin, ensureExams };
