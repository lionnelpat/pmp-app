const express  = require('express');
const bcrypt   = require('bcryptjs');
const { query, queryOne } = require('../db');
const { signToken, verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, fullName, password } = req.body;
    if (!username || !email || !fullName || !password)
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });

    const existing = await queryOne(
      'SELECT id FROM users WHERE username=$1 OR email=$2', [username, email]
    );
    if (existing)
      return res.status(409).json({ error: 'Identifiant ou email déjà utilisé' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await queryOne(
      `INSERT INTO users (username, email, full_name, password, role, status)
       VALUES ($1,$2,$3,$4,'user','pending') RETURNING id`,
      [username, email, fullName, hashed]
    );
    res.status(201).json({
      message: 'Inscription enregistrée. En attente de validation par un administrateur.',
      userId: user.id
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

    const user = await queryOne(
      'SELECT * FROM users WHERE username=$1 OR email=$1', [username]
    );
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Identifiants incorrects' });

    if (user.status === 'pending')
      return res.status(403).json({ error: 'Compte en attente de validation par un administrateur' });
    if (user.status === 'rejected')
      return res.status(403).json({ error: 'Inscription refusée. Contactez l\'administrateur.' });
    if (user.status === 'blocked')
      return res.status(403).json({ error: 'Compte bloqué. Contactez l\'administrateur.' });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name, role: user.role, status: user.status }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await queryOne(
      'SELECT id,username,email,full_name,role,status FROM users WHERE id=$1', [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ ...user, fullName: user.full_name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
