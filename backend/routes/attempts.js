const express = require('express');
const { query, queryOne, insert, exec } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { attemptTimeLimitSeconds } = require('../lib/questions');

const router = express.Router();
router.use(verifyToken);

// POST /api/attempts
router.post('/', async (req, res) => {
  try {
    const { examId, candidateName, questionCount, shuffled } = req.body;
    if (!examId) return res.status(400).json({ error: 'examId requis' });

    const exam = await queryOne(
      `SELECT e.id, e.duration_minutes,
              COUNT(q.id) FILTER (WHERE q.playable)::int AS playable_count,
              COUNT(q.id)::int AS total_questions
       FROM exams e LEFT JOIN questions q ON q.exam_id=e.id
       WHERE e.id=$1 GROUP BY e.id`,
      [examId]
    );
    if (!exam) return res.status(404).json({ error: 'Examen introuvable' });

    // Nombre de questions réellement servies pour cette tentative
    const reqCount = questionCount && questionCount > 0
      ? Math.min(questionCount, exam.playable_count)
      : exam.playable_count;

    const timeLimit = attemptTimeLimitSeconds({
      durationMinutes:   exam.duration_minutes || 0,
      questionCount:     reqCount,
      playableCount:     exam.playable_count,
      totalExamQuestions: exam.total_questions,
    });

    const att = await insert(
      `INSERT INTO attempts (user_id,exam_id,candidate_name,question_count,shuffled,time_limit_seconds,status)
       VALUES ($1,$2,$3,$4,$5,$6,'in_progress')
       RETURNING id, started_at, time_limit_seconds`,
      [req.user.id, examId, candidateName||req.user.username, reqCount, shuffled||false, timeLimit || null]
    );
    res.status(201).json({
      attemptId: att.id,
      startedAt: att.started_at,
      timeLimitSeconds: att.time_limit_seconds,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/attempts/:id/submit
router.post('/:id/submit', async (req, res) => {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers[] requis' });
    const attempt = await queryOne(
      `SELECT * FROM attempts WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]
    );
    if (!attempt) return res.status(404).json({ error: 'Tentative introuvable' });
    if (attempt.status === 'done') return res.status(409).json({ error: 'Tentative déjà soumise' });

    let correct = 0;
    for (const ans of answers) {
      const q = await queryOne('SELECT id, question_type FROM questions WHERE id=$1', [ans.questionId]);
      if (!q) continue;

      let ok = false;
      let answerData = null;

      if (q.question_type === 'multi') {
        // Tout-ou-rien : l'ensemble sélectionné doit égaler l'ensemble des bonnes options.
        const rows = await query('SELECT letter FROM options WHERE question_id=$1 AND is_correct=true', [q.id]);
        const correctSet = new Set(rows.map(r => r.letter));
        const sel = new Set(Array.isArray(ans.selectedLetters) ? ans.selectedLetters : []);
        ok = correctSet.size > 0 && correctSet.size === sel.size && [...correctSet].every(l => sel.has(l));
        answerData = { selectedLetters: [...sel] };
      } else if (q.question_type === 'match') {
        // Toutes les paires doivent correspondre.
        const rows = await query('SELECT left_text, right_text FROM match_pairs WHERE question_id=$1', [q.id]);
        const userPairs = (ans.pairs && typeof ans.pairs === 'object') ? ans.pairs : {};
        ok = rows.length > 0 && rows.every(r => (userPairs[r.left_text] ?? null) === r.right_text);
        answerData = { pairs: userPairs };
      } else {
        // single : la lettre choisie doit être la bonne option.
        const co = await queryOne('SELECT letter FROM options WHERE question_id=$1 AND is_correct=true LIMIT 1', [q.id]);
        ok = !!co && co.letter === ans.selectedLetter;
      }

      if (ok) correct++;
      await exec(
        `INSERT INTO attempt_answers (attempt_id,question_id,selected_letter,answer_data,is_correct)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, q.id, ans.selectedLetter ?? null, answerData ? JSON.stringify(answerData) : null, ok]
      );
    }
    await exec(
      `UPDATE attempts SET finished_at=NOW(), score_correct=$1, score_total=$2, status='done' WHERE id=$3`,
      [correct, answers.length, req.params.id]
    );
    res.json({ success: true, scoreCorrect: correct, scoreTotal: answers.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/attempts/:id/results
router.get('/:id/results', async (req, res) => {
  try {
    const attempt = await queryOne(
      `SELECT a.*, e.name AS exam_name FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=$1 AND a.user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!attempt) return res.status(404).json({ error: 'Tentative introuvable' });

    const answers = await query(`
      SELECT aa.*, q.question_text, q.correct_letter, q.correct_text,
             q.explanation, q.question_num, q.is_multi_select, q.question_type
      FROM attempt_answers aa
      JOIN questions q ON q.id=aa.question_id
      WHERE aa.attempt_id=$1
      ORDER BY q.question_num ASC
    `, [req.params.id]);

    const detailed = await Promise.all(answers.map(async a => {
      const row = {
        ...a,
        options: await query('SELECT letter, option_text, is_correct FROM options WHERE question_id=$1 ORDER BY letter', [a.question_id]),
      };
      if (a.question_type === 'match') {
        row.matchPairs = await query('SELECT left_text, right_text, position FROM match_pairs WHERE question_id=$1 ORDER BY position', [a.question_id]);
      }
      return row;
    }));
    res.json({ ...attempt, answers: detailed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/attempts/:id  — abandon
router.delete('/:id', async (req, res) => {
  try {
    await exec('DELETE FROM attempt_answers WHERE attempt_id=$1', [req.params.id]);
    await exec(`DELETE FROM attempts WHERE id=$1 AND user_id=$2 AND status='in_progress'`, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
