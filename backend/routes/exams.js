const express = require('express');
const multer  = require('multer');
const db = require('../db');
const { query, queryOne, insert, exec } = db;
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { importExam } = require('../lib/questions');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage() });

// GET /api/exams/public/stats  — no auth required
router.get('/public/stats', async (req, res) => {
  try {
    const [exams, questions, users, attempts, avgRow, passRow] = await Promise.all([
      queryOne('SELECT COUNT(*)::int n FROM exams'),
      queryOne('SELECT COUNT(*)::int n FROM questions'),
      queryOne(`SELECT COUNT(*)::int n FROM users WHERE role!='admin' AND status='active'`),
      queryOne(`SELECT COUNT(*)::int n FROM attempts WHERE status='done'`),
      queryOne(`SELECT ROUND(AVG(score_correct::numeric/score_total*100))::int avg FROM attempts WHERE status='done' AND score_total>0`),
      queryOne(`SELECT COUNT(*)::int n FROM attempts WHERE status='done' AND score_total>0 AND score_correct::numeric/score_total>=0.75`),
    ]);
    const att = attempts.n;
    res.json({
      exams: exams.n, questions: questions.n, users: users.n, attempts: att,
      avgScore: avgRow.avg || 0,
      passRate: att ? Math.round(passRow.n / att * 100) : 0
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/exams
router.get('/', verifyToken, async (req, res) => {
  try {
    const exams = await query(`
      SELECT e.*,
        COUNT(DISTINCT q.id) FILTER (WHERE q.playable)::int     AS question_count,
        COUNT(DISTINCT q.id) FILTER (WHERE NOT q.playable)::int AS excluded_count,
        COUNT(DISTINCT q.id)::int AS total_questions,
        COUNT(DISTINCT q.id) FILTER (WHERE q.playable AND q.question_type='multi')::int AS multi_count,
        COUNT(DISTINCT q.id) FILTER (WHERE q.playable AND q.question_type='match')::int AS match_count,
        COUNT(DISTINCT a.id)::int AS attempt_count
      FROM exams e
      LEFT JOIN questions q ON q.exam_id=e.id
      LEFT JOIN attempts a ON a.exam_id=e.id AND a.user_id=$1 AND a.status='done'
      GROUP BY e.id ORDER BY e.id ASC
    `, [req.user.id]);
    res.json(exams);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/exams/:id/questions
router.get('/:id/questions', verifyToken, async (req, res) => {
  try {
    const { limit, shuffle } = req.query;
    const exam = await queryOne('SELECT id FROM exams WHERE id=$1', [req.params.id]);
    if (!exam) return res.status(404).json({ error: 'Examen introuvable' });

    // Seules les questions « jouables » (données complètes) sont livrées :
    // single + multi (avec options) + match (avec paires).
    let questions = await query(
      `SELECT id, question_num, question_text, question_type, is_multi_select
       FROM questions WHERE exam_id=$1 AND playable=true ORDER BY question_num ASC`,
      [req.params.id]
    );
    if (shuffle === 'true') {
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }
    if (limit) questions = questions.slice(0, parseInt(limit));

    const shuf = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

    // ⚠️ On ne renvoie JAMAIS la bonne réponse au client pendant le quiz.
    const result = await Promise.all(questions.map(async q => {
      const base = {
        id: q.id, question_num: q.question_num, question_text: q.question_text,
        question_type: q.question_type, is_multi_select: q.is_multi_select,
      };
      if (q.question_type === 'match') {
        const pairs = await query('SELECT left_text, right_text FROM match_pairs WHERE question_id=$1 ORDER BY position', [q.id]);
        base.matchPremises  = pairs.map(p => p.left_text);                       // colonne gauche (ordre fixe)
        base.matchResponses = shuf([...new Set(pairs.map(p => p.right_text))]);  // colonne droite (mélangée)
      } else {
        const opts = await query('SELECT letter, option_text FROM options WHERE question_id=$1 ORDER BY letter', [q.id]);
        base.options = opts;  // sans is_correct
      }
      return base;
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/exams/:id/attempts
router.get('/:id/attempts', verifyToken, async (req, res) => {
  try {
    const attempts = await query(
      'SELECT * FROM attempts WHERE exam_id=$1 AND user_id=$2 ORDER BY started_at DESC',
      [req.params.id, req.user.id]
    );
    res.json(attempts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/exams/import  — admin only
router.post('/import', verifyToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    let data;
    if (req.file) data = JSON.parse(req.file.buffer.toString('utf8'));
    else return res.status(400).json({ error: 'Fichier JSON requis' });
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Format invalide: tableau attendu' });

    const name = req.body.name || 'Examen importé';
    const desc = req.body.description || `${data.length} questions importées`;
    const { examId, total, counts } = await importExam(db, { name, description: desc }, data);
    res.json({ success: true, examId, imported: total, counts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/exams/:id  — admin only
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const questions = await query('SELECT id FROM questions WHERE exam_id=$1', [req.params.id]);
    for (const q of questions) await exec('DELETE FROM options WHERE question_id=$1', [q.id]);
    const attempts  = await query('SELECT id FROM attempts WHERE exam_id=$1', [req.params.id]);
    for (const a of attempts) await exec('DELETE FROM attempt_answers WHERE attempt_id=$1', [a.id]);
    await exec('DELETE FROM attempts WHERE exam_id=$1', [req.params.id]);
    await exec('DELETE FROM questions WHERE exam_id=$1', [req.params.id]);
    await exec('DELETE FROM exams WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
