require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { connect, initSchema } = require('./db');
const { ensureAdmin, ensureExams } = require('./lib/bootstrap');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/exams',    require('./routes/exams'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/admin',    require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// API-only : le frontend est servi par son propre conteneur nginx.
// Toute route inconnue renvoie un 404 JSON (pas de fichiers statiques ici).
app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));

async function start() {
  try {
    await connect();
    await initSchema();
    await ensureAdmin();   // self-healing : un admin existe toujours
    await ensureExams();   // import auto si la base est vide (1ère exécution)
    app.listen(PORT, () => {
      console.log(`\n🚀  PMP Quiz API  →  http://localhost:${PORT}`);
      console.log(`📚  Mode : ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n   Pour seeder la BDD :  npm run seed\n`);
    });
  } catch (err) {
    console.error('❌  Démarrage impossible :', err.message);
    console.error('   Vérifiez que PostgreSQL tourne (docker compose up -d)');
    process.exit(1);
  }
}

start();
