/**
 * Helpers partagés pour la classification des questions et le calcul des durées.
 * Utilisés par scripts/seed.js et routes/exams.js (import).
 */

// Détecte le type d'une question à partir de son énoncé et de ses options.
//   'single' → choix unique classique (4 options, 1 bonne réponse)
//   'multi'  → choix multiples ("Choisissez deux/trois")
//   'match'  → appariement ("Faites correspondre", "Reliez"…)
// Les trois types sont jouables dès lors que les données sont complètes (voir `playable`
// dans importExam). Une question est exclue d'un quiz uniquement si ses données sont
// insuffisantes (options manquantes, paires absentes).
// Normalise les libellés de type rencontrés dans les exports.
const TYPE_ALIASES = {
  single: 'single', single_choice: 'single', singlechoice: 'single',
  multi: 'multi',   multiple_choice: 'multi', multiplechoice: 'multi', multi_choice: 'multi',
  match: 'match',   matching: 'match', match_pairs: 'match',
};

function classifyQuestion(q) {
  // Type explicite prioritaire (export corrigé) — voir backend/data/FORMAT_QUESTIONS.md
  const explicit = TYPE_ALIASES[String(q.questionType || '').toLowerCase()];
  if (explicit) return explicit;

  const t = (q.questionText || '').toLowerCase();

  const isMatch = /relier|reliez|associez|associer|faites?\s+correspond|correspondance|colonne\s+de\s+(droite|gauche)|glisser|glisser-d|déposer|faites\s+glisser/.test(t);
  if (isMatch) return 'match';

  const isMulti = /choisissez[-\s]?en\s+(deux|2|trois|3)|choisissez\s+(deux|2|trois|3)|sélectionnez\s+(deux|2|trois|3|toutes)/.test(t);
  if (isMulti) return 'multi';

  // Options absentes mais énoncé non reconnu → question spéciale non standard → exclue (traitée comme 'multi')
  if (!Array.isArray(q.options) || q.options.length === 0) return 'multi';

  return 'single';
}

// Durée officielle d'un examen complet, en minutes, selon le nombre de questions.
//   180 questions → 3 h 50 (230 min) — examen PMP réel
//   120 questions → 2 h (120 min)
//    60 questions → 1 h (60 min)
//   autre → proportionnel au rythme officiel (230/180 ≈ 1,28 min/question)
function examDurationMinutes(totalQuestions) {
  if (totalQuestions >= 180) return 230;
  if (totalQuestions >= 120) return 120;
  if (totalQuestions >= 60)  return 60;
  return Math.max(5, Math.round(totalQuestions * 230 / 180));
}

// Calcule la limite de temps (en secondes) d'une TENTATIVE.
//   - mode complet (questionCount >= nbQuestionsJouables) → durée officielle pleine
//   - mode personnalisé → prorata du rythme officiel (durée/totalQuestions de l'examen)
// totalExamQuestions = nombre nominal de questions de l'examen (toutes catégories confondues).
function attemptTimeLimitSeconds({ durationMinutes, questionCount, playableCount, totalExamQuestions }) {
  const full = durationMinutes * 60;
  if (!questionCount || questionCount >= playableCount) return full;       // examen complet
  const rate = (durationMinutes * 60) / (totalExamQuestions || playableCount || questionCount);
  return Math.max(60, Math.round(rate * questionCount));                    // ≥ 1 min plancher
}

// Importe un examen complet (insère l'examen + ses questions + options) avec
// classification automatique. `db` doit exposer { insert, exec }.
// Retourne { examId, total, duration, counts }.
async function importExam(db, { name, description }, questions) {
  const { insert, exec } = db;
  const total    = questions.length;
  const duration = examDurationMinutes(total);

  const exam = await insert(
    'INSERT INTO exams (name,description,duration_minutes) VALUES ($1,$2,$3) RETURNING id',
    [name, description, duration]
  );
  const examId = exam.id;
  const counts = { single: 0, multi: 0, match: 0 };
  let n = 0, playableCount = 0;

  for (const q of questions) {
    n++;
    const type = classifyQuestion(q);
    counts[type] = (counts[type] || 0) + 1;

    // ── Options + bonnes réponses ───────────────────────────
    //   priorité : o.isCorrect explicite
    //   sinon multi : texte ∈ correctAnswers[]
    //   sinon single : texte == correctAnswer
    const correctSet = new Set((q.correctAnswers || []).map(s => (s || '').trim()));
    const opts = (q.options || []).map(o => ({
      letter: o.letter, text: o.text,
      isCorrect: o.isCorrect === true
        || correctSet.has((o.text || '').trim())
        || (type === 'single' && (o.text || '').trim() === (q.correctAnswer || '').trim()),
    }));
    const correctLetters = opts.filter(o => o.isCorrect).map(o => o.letter);
    const cLet = type === 'single' ? (correctLetters[0] || '') : correctLetters.join(',');
    const correctText = q.correctAnswer
      || (q.correctAnswers ? q.correctAnswers.join(' | ') : '')
      || '';

    // ── Paires d'appariement (premise/response OU left/right) ─
    const rawPairs = Array.isArray(q.correctPairs) ? q.correctPairs
                   : Array.isArray(q.pairs)        ? q.pairs
                   : [];
    const pairs = rawPairs
      .map(p => ({ left: p.premise ?? p.left, right: p.response ?? p.right }))
      .filter(p => p.left != null && p.right != null);

    // ── Jouable ? (données suffisantes pour passer le quiz) ──
    const playable =
      (type === 'single' && opts.length > 0 && correctLetters.length > 0) ||
      (type === 'multi'  && opts.length > 0 && correctLetters.length > 0) ||
      (type === 'match'  && pairs.length > 0);
    if (playable) playableCount++;

    const qRow = await insert(
      `INSERT INTO questions
         (exam_id,question_num,question_text,question_type,correct_letter,correct_text,explanation,is_multi_select,playable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [examId, parseInt(q.questionNum) || n, q.questionText || '', type, cLet,
       correctText, q.explanation || '', type !== 'single', playable]
    );

    for (const opt of opts) {
      await exec(
        'INSERT INTO options (question_id,letter,option_text,is_correct) VALUES ($1,$2,$3,$4)',
        [qRow.id, opt.letter, opt.text, opt.isCorrect]
      );
    }

    let pos = 0;
    for (const p of pairs) {
      await exec(
        'INSERT INTO match_pairs (question_id,left_text,right_text,position) VALUES ($1,$2,$3,$4)',
        [qRow.id, String(p.left), String(p.right), pos++]
      );
    }
  }

  return { examId, total, duration, counts, playableCount, excludedCount: total - playableCount };
}

module.exports = { classifyQuestion, examDurationMinutes, attemptTimeLimitSeconds, importExam };
