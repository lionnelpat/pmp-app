/**
 * Réinitialise (ou crée) le compte administrateur à partir des variables
 * d'environnement, puis sort. Idempotent et NON destructif pour le reste.
 *
 *   node scripts/reset-admin.js
 *
 * Utile quand le mot de passe en base ne correspond plus à ADMIN_PASSWORD
 * (ex. admin créé lors d'un premier déploiement avec un autre mot de passe).
 * Variables lues : ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { connect, queryOne, exec } = require('../db');

async function run() {
  await connect();

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin2024!';
  const email    = process.env.ADMIN_EMAIL    || 'admin@pmp.local';
  const hash     = await bcrypt.hash(password, 10);

  const existing = await queryOne('SELECT id FROM users WHERE username=$1', [username]);
  if (existing) {
    await exec(
      `UPDATE users
         SET password=$1, email=$2, role='admin', status='active', approved_at=NOW()
       WHERE username=$3`,
      [hash, email, username]
    );
    console.log(`✅  Admin "${username}" mis à jour — mot de passe réinitialisé.`);
  } else {
    await exec(
      `INSERT INTO users (username, email, full_name, password, role, status, approved_at)
       VALUES ($1, $2, 'Administrateur', $3, 'admin', 'active', NOW())`,
      [username, email, hash]
    );
    console.log(`✅  Admin "${username}" créé.`);
  }

  // Affiche les comptes admin présents (sans secret) pour vérification.
  const admins = await queryOne(
    `SELECT string_agg(username, ', ') AS list FROM users WHERE role='admin'`
  );
  console.log(`ℹ️   Comptes admin en base : ${admins?.list || '(aucun)'}`);
  process.exit(0);
}

run().catch(err => { console.error('❌  Échec reset-admin :', err.message); process.exit(1); });
