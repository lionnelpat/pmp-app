/**
 * Seed script — (ré)initialise la base de données.
 *   node scripts/seed.js
 *
 * Crée :
 *   - Admin (admin / Admin2024!)
 *   - Les examens présents dans backend/data/ (5 examens)
 *
 * NB : ce script REMET À ZÉRO le contenu des quiz (examens, questions, tentatives)
 *      afin de réappliquer la classification des types de questions et les durées.
 *      Les comptes utilisateurs sont conservés.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');
const db     = require('../db');
const { connect, initSchema, queryOne, exec } = db;
const { importExam } = require('../lib/questions');
const EXAM_FILES = require('../lib/examFiles');

const DATA = path.join(__dirname, '..', 'data');

async function seed() {
  await connect();
  await initSchema();

  // ── 1. Admin ─────────────────────────────────────────────
  const adminExists = await queryOne(`SELECT id FROM users WHERE username='admin'`);
  if (!adminExists) {
    const hash = await bcrypt.hash('Admin2024!', 10);
    await exec(
      `INSERT INTO users (username,email,full_name,password,role,status,approved_at)
       VALUES ('admin','admin@pmp.local','Administrateur',$1,'admin','active',NOW())`,
      [hash]
    );
    console.log('✅  Admin créé  →  admin / Admin2024!');
  } else {
    console.log('ℹ️   Admin déjà existant');
  }

  // ── 2. Reset du contenu quiz (conserve les utilisateurs) ─
  await exec('TRUNCATE attempt_answers, attempts, match_pairs, options, questions, exams RESTART IDENTITY CASCADE');
  console.log('🧹  Contenu quiz réinitialisé');

  // ── 3. Import des examens ────────────────────────────────
  let totalSingle = 0, totalExcluded = 0;
  for (const { file, name, desc } of EXAM_FILES) {
    const full = path.join(DATA, file);
    if (!fs.existsSync(full)) { console.warn(`⚠️   Fichier introuvable : ${file}`); continue; }

    const questions = JSON.parse(fs.readFileSync(full, 'utf8'));
    const { total, duration, counts, playableCount, excludedCount } = await importExam(db, { name, description: desc }, questions);
    totalSingle   += playableCount;
    totalExcluded += excludedCount;
    console.log(
      `✅  "${name}"  →  ${total} questions (durée ${duration} min) · ` +
      `${playableCount} jouables [${counts.single} unique, ${counts.multi} QCM, ${counts.match} appariement]` +
      (excludedCount ? `, ${excludedCount} exclues (données incomplètes)` : '')
    );
  }

  console.log(`\n🎓  Base prête ! ${totalSingle} questions jouables, ${totalExcluded} exclues (données incomplètes).\n`);
  process.exit(0);
}

seed().catch(err => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
