const express = require('express');
const { query, queryOne, exec } = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken, requireAdmin);

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.status,
             u.created_at, u.approved_at,
             COUNT(DISTINCT a.id)::int AS attempt_count,
             MAX(CASE WHEN a.status='done' AND a.score_total>0
                 THEN ROUND(a.score_correct::numeric/a.score_total*100)
                 ELSE NULL END) AS best_score
      FROM users u
      LEFT JOIN attempts a ON a.user_id=u.id
      WHERE u.role != 'admin'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/users/:id/status
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active','pending','rejected','blocked'].includes(status))
      return res.status(400).json({ error: 'Statut invalide' });
    const approvedAt = status === 'active' ? 'NOW()' : 'NULL';
    await exec(
      `UPDATE users SET status=$1, approved_at=${approvedAt} WHERE id=$2 AND role!='admin'`,
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await queryOne('SELECT id,role FROM users WHERE id=$1', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Impossible de supprimer un admin' });
    // Cascade cleanup
    const attempts = await query('SELECT id FROM attempts WHERE user_id=$1', [user.id]);
    for (const a of attempts) await exec('DELETE FROM attempt_answers WHERE attempt_id=$1', [a.id]);
    await exec('DELETE FROM attempts WHERE user_id=$1', [user.id]);
    await exec('DELETE FROM users WHERE id=$1', [user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, active, pending, attempts, avgRow, passRow, examStats] = await Promise.all([
      queryOne(`SELECT COUNT(*)::int n FROM users WHERE role!='admin'`),
      queryOne(`SELECT COUNT(*)::int n FROM users WHERE role!='admin' AND status='active'`),
      queryOne(`SELECT COUNT(*)::int n FROM users WHERE role!='admin' AND status='pending'`),
      queryOne(`SELECT COUNT(*)::int n FROM attempts WHERE status='done'`),
      queryOne(`SELECT ROUND(AVG(score_correct::numeric/score_total*100))::int avg FROM attempts WHERE status='done' AND score_total>0`),
      queryOne(`SELECT COUNT(*)::int n FROM attempts WHERE status='done' AND score_total>0 AND score_correct::numeric/score_total>=0.75`),
      query(`SELECT e.id, e.name,
               COUNT(DISTINCT a.id)::int AS attempt_count,
               ROUND(AVG(CASE WHEN a.status='done' THEN a.score_correct::numeric/a.score_total*100 END))::int AS avg_score,
               COUNT(CASE WHEN a.status='done' AND a.score_correct::numeric/a.score_total>=0.75 THEN 1 END)::int AS pass_count
             FROM exams e LEFT JOIN attempts a ON a.exam_id=e.id
             GROUP BY e.id ORDER BY e.id`),
    ]);
    res.json({
      users: users.n, active: active.n, pending: pending.n, attempts: attempts.n,
      avgScore: avgRow.avg || 0,
      passRate: attempts.n ? Math.round(passRow.n / attempts.n * 100) : 0,
      examStats
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
