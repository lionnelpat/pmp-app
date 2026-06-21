import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Spinner, Badge, GradeBadge, ScoreDial, Toggle, ProgressBar } from '../components/UI';

// ─── Helpers durée / minuteur ─────────────────────────────────
// "3 h 50", "2 h", "1 h", "51 min"
function fmtDuration(min) {
  if (!min && min !== 0) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h && m) return `${h} h ${String(m).padStart(2, '0')}`;
  if (h)      return `${h} h`;
  return `${m} min`;
}
// décompte : "H:MM:SS" ou "MM:SS"
function fmtTimer(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// Pauses pendant l'examen (≈ format PMP : une pause à chaque tiers).
const BREAK_SECONDS = 300;          // durée d'une pause : 5 min
const MIN_TOTAL_FOR_BREAKS = 60;    // pas de pause en dessous de ce nombre de questions

// Une question est-elle considérée comme répondue ?
function isAnswered(q, a) {
  if (q.question_type === 'multi') return Array.isArray(a) && a.length > 0;
  if (q.question_type === 'match') return a && typeof a === 'object' && Object.keys(a).length > 0;
  return a != null && a !== '';
}

// Construit l'entrée de payload de soumission selon le type.
function answerPayload(q, a) {
  if (q.question_type === 'multi') return { questionId: q.id, selectedLetters: Array.isArray(a) ? a : [] };
  if (q.question_type === 'match') return { questionId: q.id, pairs: (a && typeof a === 'object') ? a : {} };
  return { questionId: q.id, selectedLetter: a ?? null };
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────
export function DashboardPage({ onNavigate }) {
  const { user } = useAuth();
  const [exams, setExams]       = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([api.get('/exams'), api.get('/attempts/user/all').catch(() => ({ data: [] }))])
      .then(([er]) => { setExams(er.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const totalAttempts = exams.reduce((s, e) => s + (e.attempt_count || 0), 0);

  return (
    <div className="container page">
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Bienvenue, {user.fullName}</h1>
        <p className="text-muted">Votre espace de préparation PMP · PMBOK 7 & Agile</p>
      </div>

      <div className="grid-3 mb-24">
        {[
          { icon: 'ti-books',  v: exams.length,    l: 'Examens disponibles' },
          { icon: 'ti-writing',v: totalAttempts,   l: 'Tentatives effectuées' },
          { icon: 'ti-target', v: exams.reduce((s, e) => s + (e.question_count || 0), 0), l: 'Questions' },
        ].map(({ icon, v, l }) => (
          <div key={l} className="stat-box">
            <i className={`ti ${icon}`} style={{ fontSize: 22, color: '#94a3b8' }} aria-hidden="true" />
            <div className="stat-box-n">{v}</div>
            <div className="stat-box-l">{l}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Examens disponibles</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 14 }}>
        {exams.map(exam => (
          <ExamCard key={exam.id} exam={exam} onStart={() => onNavigate('config', exam)} />
        ))}
      </div>
    </div>
  );
}

function ExamCard({ exam, onStart }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{exam.name}</h3>
          <p className="text-muted text-small">{exam.description}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <Badge text={`${exam.question_count} questions`} variant="blue" />
        {exam.duration_minutes ? <Badge text={`⏱ ${fmtDuration(exam.duration_minutes)}`} variant="green" /> : null}
        <Badge text={`${exam.attempt_count || 0} tentative${exam.attempt_count !== 1 ? 's' : ''}`} variant="gray" />
      </div>
      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onStart}>
        <i className="ti ti-player-play" aria-hidden="true" /> Commencer
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  CONFIG PAGE
// ─────────────────────────────────────────────────────────────
export function ConfigPage({ exam, onStart, onBack }) {
  const { user } = useAuth();
  const [name,    setName]    = useState(user.fullName);
  const [mode,    setMode]    = useState('full');
  const [count,   setCount]   = useState(40);
  const [shuffle, setShuffle] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get(`/exams/${exam.id}/attempts`).then(r => setHistory(r.data)).catch(() => {});
  }, [exam.id]);

  const qCount = mode === 'full' ? exam.question_count : Math.min(count, exam.question_count);
  // Durée estimée : examen complet = durée officielle ; personnalisé = au prorata.
  const estDuration = exam.duration_minutes
    ? (mode === 'full'
        ? exam.duration_minutes
        : Math.max(1, Math.round(exam.duration_minutes * qCount / (exam.total_questions || exam.question_count || qCount))))
    : null;
  function fmt(dt) { return new Date(dt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  return (
    <div style={{ maxWidth: 580, margin: '0 auto', padding: '24px 16px 64px' }}>
      <button className="btn btn-sm" style={{ marginBottom: 20 }} onClick={onBack}>
        <i className="ti ti-arrow-left" aria-hidden="true" /> Retour
      </button>

      <div className="card mb-16">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{exam.name}</h2>
        <p className="text-muted text-small mb-16">{exam.description}</p>

        <div className="input-group">
          <label>Nom du candidat</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="input-group">
          <label>Mode d'examen</label>
          <div className="grid-2">
            {[{ v: 'full', l: 'Examen complet', d: `${exam.question_count} questions` }, { v: 'custom', l: 'Personnalisé', d: 'Au choix' }].map(o => (
              <div key={o.v} onClick={() => setMode(o.v)} style={{ padding: 12, borderRadius: 8, cursor: 'pointer', border: `2px solid ${mode === o.v ? '#3b82f6' : '#e2e8f0'}`, background: mode === o.v ? '#eff6ff' : '#f8fafc', transition: 'all .15s' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: mode === o.v ? '#1d4ed8' : '#0f172a' }}>{o.l}</div>
                <div className="text-muted text-small">{o.d}</div>
              </div>
            ))}
          </div>
        </div>

        {mode === 'custom' && (
          <div className="input-group">
            <label>Nombre de questions : <strong style={{ color: '#3b82f6' }}>{count}</strong></label>
            <input type="range" min={10} max={exam.question_count} step={10} value={count} onChange={e => setCount(+e.target.value)} style={{ width: '100%', accentColor: '#3b82f6' }} />
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <Toggle on={shuffle} onChange={setShuffle} label="Mélanger les questions" />
        </div>

        {estDuration && (
          <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-clock" aria-hidden="true" />
            <span>Temps imparti : <strong>{fmtDuration(estDuration)}</strong> — l'examen est soumis automatiquement à la fin du temps.</span>
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => onStart({ examId: exam.id, candidateName: name, questionCount: qCount, shuffled: shuffle })}>
          <i className="ti ti-player-play" aria-hidden="true" /> Démarrer — {qCount} questions{estDuration ? ` · ${fmtDuration(estDuration)}` : ''}
        </button>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Mes tentatives</h3>
          {history.slice(0, 5).map(a => {
            const p = a.score_total ? Math.round(a.score_correct / a.score_total * 100) : 0;
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: p >= 75 ? '#15803d' : p >= 61 ? '#92400e' : '#b91c1c', minWidth: 44 }}>{p}%</div>
                <div style={{ flex: 1 }}>
                  <div className="text-muted text-small">{fmt(a.started_at)} · {a.score_correct}/{a.score_total}</div>
                </div>
                <GradeBadge pct={p} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  QUIZ PAGE
// ─────────────────────────────────────────────────────────────
export function QuizPage({ attemptId, questions, candidateName, timeLimitSeconds, startedAt, onFinish, onAbandon }) {
  const [idx,     setIdx]     = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSub]  = useState(false);
  const [remaining, setRemaining] = useState(null); // secondes restantes (null = pas de minuteur)
  const [timeUp,   setTimeUp] = useState(false);

  // ── Pauses aux tiers de l'examen ──
  const [onBreak,      setOnBreak]      = useState(false);
  const [breakSecLeft, setBreakSecLeft] = useState(BREAK_SECONDS);
  const onBreakRef     = useRef(false);     // miroir de onBreak pour le tick minuteur
  const breakStartRef  = useRef(0);         // horodatage du début de la pause
  const breakOffsetRef = useRef(0);         // ms de pause cumulés (étendent l'échéance)
  const breaksTakenRef = useRef(new Set()); // frontières déjà déclenchées

  const submittedRef = useRef(false);
  const answersRef   = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  const cur = questions[idx];
  const total = questions.length;
  const answered = questions.filter(q => isAnswered(q, answers[q.id])).length;

  // Frontières de pause : aux tiers (1/3 et 2/3) pour les examens assez longs.
  // Ex. 180 questions → pauses après la Q60 et la Q120.
  const breakBoundaries = useMemo(
    () => (total >= MIN_TOTAL_FOR_BREAKS ? [Math.floor(total / 3), Math.floor(total / 3) * 2] : []),
    [total]
  );

  // single : sélection unique
  function pick(letter) {
    setAnswers(p => ({ ...p, [cur.id]: letter }));
  }
  // multi : bascule une lettre dans le tableau
  function toggleMulti(letter) {
    setAnswers(p => {
      const arr = Array.isArray(p[cur.id]) ? p[cur.id] : [];
      const next = arr.includes(letter) ? arr.filter(l => l !== letter) : [...arr, letter];
      return { ...p, [cur.id]: next };
    });
  }
  // match : associe une réponse (droite) à une prémisse (gauche)
  function setPair(premise, response) {
    setAnswers(p => {
      const prev = (p[cur.id] && typeof p[cur.id] === 'object') ? p[cur.id] : {};
      const next = { ...prev };
      if (response) next[premise] = response; else delete next[premise];
      return { ...p, [cur.id]: next };
    });
  }
  function flag() {
    setFlagged(p => { const n = new Set(p); n.has(cur.id) ? n.delete(cur.id) : n.add(cur.id); return n; });
  }

  // Soumission (manuelle ou automatique). Idempotente via submittedRef.
  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSub(true);
    const payload = questions.map(q => answerPayload(q, answersRef.current[q.id]));
    try {
      await api.post(`/attempts/${attemptId}/submit`, { answers: payload });
      onFinish(attemptId);
    } catch {
      submittedRef.current = false;
      setSub(false);
    }
  }, [questions, attemptId, onFinish]);

  // Minuteur : décompte chaque seconde, auto-soumission à 0.
  // Gelé pendant une pause ; le temps de pause étend l'échéance (il ne compte
  // pas dans le temps d'examen).
  useEffect(() => {
    if (!timeLimitSeconds || !startedAt) return;
    const startMs = new Date(startedAt).getTime();
    const tick = () => {
      if (onBreakRef.current) return;               // gelé pendant la pause
      const deadline = startMs + timeLimitSeconds * 1000 + breakOffsetRef.current;
      const rem = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) { setTimeUp(true); doSubmit(); }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [timeLimitSeconds, startedAt, doSubmit]);

  // Termine la pause : cumule sa durée réelle dans l'offset et reprend l'examen.
  const endBreak = useCallback(() => {
    breakOffsetRef.current += Date.now() - breakStartRef.current;
    onBreakRef.current = false;
    setOnBreak(false);
  }, []);

  // Déclenche une pause au franchissement d'un tiers (une seule fois par frontière).
  useEffect(() => {
    if (onBreakRef.current || breakBoundaries.length === 0) return;
    const reached = breakBoundaries.filter(b => idx >= b && !breaksTakenRef.current.has(b));
    if (reached.length === 0) return;
    reached.forEach(b => breaksTakenRef.current.add(b));
    breakStartRef.current = Date.now();
    setBreakSecLeft(BREAK_SECONDS);
    onBreakRef.current = true;
    setOnBreak(true);
  }, [idx, breakBoundaries]);

  // Décompte de la pause ; reprise automatique à 0.
  useEffect(() => {
    if (!onBreak) return;
    const iv = setInterval(() => {
      const left = Math.max(0, BREAK_SECONDS - Math.round((Date.now() - breakStartRef.current) / 1000));
      setBreakSecLeft(left);
      if (left <= 0) endBreak();
    }, 1000);
    return () => clearInterval(iv);
  }, [onBreak, endBreak]);

  if (!cur) return null;

  const lowTime = remaining !== null && remaining <= 300;   // < 5 min
  const midTime = remaining !== null && remaining <= 600;   // < 10 min
  const timerColor = lowTime ? '#dc2626' : midTime ? '#d97706' : '#0f172a';

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 16px 48px' }}>
      {/* Pause (aux tiers de l'examen) */}
      {onBreak && (
        <div className="modal-overlay" style={{ zIndex: 60 }}>
          <div className="modal" style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>☕</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Pause</h3>
            <p className="text-muted" style={{ fontSize: 14, marginBottom: 18 }}>
              Vous avez terminé une section. Faites une pause — <strong>le temps d'examen est gelé</strong>.
            </p>
            <div style={{ fontSize: 46, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#0f172a', lineHeight: 1 }}>
              {fmtTimer(breakSecLeft)}
            </div>
            <div className="text-muted text-small" style={{ margin: '8px 0 20px' }}>
              Reprise automatique à la fin de la pause · question {idx + 1}/{total}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={endBreak}>
              <i className="ti ti-player-play" aria-hidden="true" /> Reprendre maintenant
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{candidateName}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {remaining !== null && (
            <span title="Temps restant"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14,
                color: timerColor, padding: '3px 10px', borderRadius: 8,
                background: lowTime ? '#fef2f2' : midTime ? '#fffbeb' : '#fff',
                border: `1px solid ${lowTime ? '#fecaca' : midTime ? '#fde68a' : '#e2e8f0'}`,
                animation: lowTime ? 'pulse 1s ease-in-out infinite' : 'none',
              }}>
              <i className="ti ti-clock" aria-hidden="true" /> {fmtTimer(remaining)}
            </span>
          )}
          <span className="text-muted text-small">{answered}/{total} répondues</span>
          <button className="btn btn-danger btn-sm" onClick={onAbandon}>Abandonner</button>
        </div>
      </div>

      {timeUp && (
        <div className="alert alert-err" style={{ marginBottom: 12 }}>
          ⏱ <strong>Temps écoulé</strong> — l'examen est soumis automatiquement…
        </div>
      )}

      <ProgressBar value={idx} max={total} style={{ marginBottom: 16 }} />

      {/* Question */}
      <div className="card mb-12">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <Badge text={`Q${cur.question_num}`} variant="blue" />
            {cur.question_type === 'multi' && <Badge text="Choix multiples" variant="amber" />}
            {cur.question_type === 'match' && <Badge text="Appariement" variant="amber" />}
            {flagged.has(cur.id) && <Badge text="Marquée" variant="amber" />}
          </div>
          <button onClick={flag} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: flagged.has(cur.id) ? '#d97706' : '#94a3b8' }}>
            {flagged.has(cur.id) ? '⚑' : '⚐'}
          </button>
        </div>

        <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 22, whiteSpace: 'pre-line' }}>{cur.question_text}</p>

        {/* ── Appariement (relier gauche → droite) ── */}
        {cur.question_type === 'match' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="text-muted text-small" style={{ margin: '0 0 4px' }}>
              Pour chaque élément de gauche, sélectionnez la bonne correspondance à droite.
            </p>
            {(cur.matchPremises || []).map((premise, i) => {
              const val = (answers[cur.id] && answers[cur.id][premise]) || '';
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 18px minmax(0,1fr)', gap: 8, alignItems: 'center' }}>
                  <div style={{ padding: '12px 14px', borderRadius: 8, border: '2px solid #e2e8f0', background: '#f8fafc', fontSize: 14, fontWeight: 600 }}>
                    {premise}
                  </div>
                  <i className="ti ti-arrow-right" aria-hidden="true" style={{ color: '#94a3b8', textAlign: 'center' }} />
                  <select value={val} onChange={e => setPair(premise, e.target.value)}
                    style={{ width: '100%', padding: '11px 12px', borderRadius: 8,
                      border: `2px solid ${val ? '#3b82f6' : '#e2e8f0'}`, background: val ? '#eff6ff' : '#fff',
                      fontSize: 14, color: val ? '#1d4ed8' : '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <option value="">— Choisir —</option>
                    {(cur.matchResponses || []).map((r, j) => <option key={j} value={r}>{r}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Choix unique / Choix multiples ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cur.question_type === 'multi' && (
              <p className="text-muted text-small" style={{ margin: '0 0 4px' }}>
                Plusieurs réponses possibles — cochez toutes les bonnes réponses.
              </p>
            )}
            {(cur.options || []).map(opt => {
              const a = answers[cur.id];
              const multi = cur.question_type === 'multi';
              const sel = multi ? (Array.isArray(a) && a.includes(opt.letter)) : (a === opt.letter);
              const onClick = () => (multi ? toggleMulti(opt.letter) : pick(opt.letter));
              return (
                <div key={opt.letter} onClick={onClick} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 8, border: `2px solid ${sel ? '#3b82f6' : '#e2e8f0'}`, background: sel ? '#eff6ff' : '#fff', cursor: 'pointer', transition: 'all .12s', alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: multi ? 6 : '50%', background: sel ? '#3b82f6' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: sel ? '#fff' : '#64748b', flexShrink: 0 }}>
                    {multi ? (sel ? '✓' : opt.letter) : opt.letter}
                  </div>
                  <span style={{ fontSize: 14, lineHeight: 1.6, flex: 1, color: sel ? '#1d4ed8' : '#0f172a' }}>{opt.option_text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="btn" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Précédente
        </button>
        <div className="qnav" style={{ maxWidth: 360 }}>
          {questions.map((q, i) => {
            const cls = i === idx ? 'qnav-btn current' : isAnswered(q, answers[q.id]) ? 'qnav-btn done' : flagged.has(q.id) ? 'qnav-btn flagged' : 'qnav-btn';
            return <button key={q.id} className={cls} onClick={() => setIdx(i)}>{i + 1}</button>;
          })}
        </div>
        {idx < total - 1
          ? <button className="btn" onClick={() => setIdx(i => Math.min(total - 1, i + 1))}>Suivante <i className="ti ti-arrow-right" aria-hidden="true" /></button>
          : <button className="btn btn-primary" onClick={() => setConfirm(true)} disabled={submitting}><i className="ti ti-send" aria-hidden="true" /> Soumettre</button>
        }
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Soumettre l'examen ?</h3>
            <p className="text-muted" style={{ fontSize: 14, marginBottom: 20 }}>
              {answered < total
                ? `⚠️ Vous n'avez répondu qu'à ${answered} question${answered !== 1 ? 's' : ''} sur ${total}. Les sans-réponse seront comptées incorrectes.`
                : `✓ Toutes les ${total} questions ont été répondues.`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirm(false)}>Continuer</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={doSubmit} disabled={submitting}>
                {submitting ? 'Envoi…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  RESULTS PAGE
// ─────────────────────────────────────────────────────────────
export function ResultsPage({ attemptId, onRetry, onBack }) {
  const [data,    setData]   = useState(null);
  const [filter,  setFilter] = useState('all');
  const [expand,  setExpand] = useState(null);
  const [search,  setSearch] = useState('');

  useEffect(() => {
    api.get(`/attempts/${attemptId}/results`).then(r => setData(r.data)).catch(() => {});
  }, [attemptId]);

  if (!data) return <Spinner />;

  const score   = data.score_total ? Math.round(data.score_correct / data.score_total * 100) : 0;
  const answers = data.answers || [];
  const wrong   = answers.filter(a => !a.is_correct);
  const correct = answers.filter(a => a.is_correct);

  const filtered = answers
    .filter(a => filter === 'wrong' ? !a.is_correct : filter === 'correct' ? a.is_correct : true)
    .filter(a => !search.trim() || a.question_text.toLowerCase().includes(search.toLowerCase()) || (a.explanation || '').toLowerCase().includes(search.toLowerCase()));

  function parseExpl(txt) {
    if (!txt) return [];
    const lines = txt.split('\n'), secs = []; let cur = null;
    const hdr = /^(Feedback|Analyse BARAKUDA|Domaine PMP|[BARAKUD]\s*—)/;
    for (const l of lines) {
      const t = l.trim(); if (!t) continue;
      if (hdr.test(t)) { if (cur) secs.push(cur); cur = { hdr: t, lines: [] }; }
      else { if (!cur) cur = { hdr: null, lines: [] }; cur.lines.push(t); }
    }
    if (cur) secs.push(cur);
    return secs;
  }

  function fmt(dt) { return new Date(dt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '16px 16px 64px' }}>
      <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>{score >= 75 ? '🏆' : score >= 61 ? '📊' : '📚'}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Résultats — {data.exam_name}</h1>
        <p className="text-muted text-small">{data.candidate_name} · {fmt(data.started_at)}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', minWidth: 156 }}>
          <ScoreDial correct={data.score_correct} total={data.score_total} />
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 700, color: score >= 75 ? '#15803d' : score >= 61 ? '#d97706' : '#b91c1c' }}>
            {score >= 75 ? '✓ Reçu' : score >= 61 ? '≈ Limite' : '✗ Échoué'}
          </div>
          <div className="text-muted text-small" style={{ marginTop: 3 }}>Seuil PMI : 75%</div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {[
              { l: 'Réponses correctes', v: data.score_correct, c: '#15803d' },
              { l: 'Réponses incorrectes', v: data.score_total - data.score_correct, c: '#b91c1c' },
              { l: 'Total répondues', v: data.score_total, c: '#0f172a' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className="text-muted" style={{ fontSize: 14 }}>{l}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onRetry}><i className="ti ti-refresh" aria-hidden="true" /> Nouvelle tentative</button>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onBack}><i className="ti ti-arrow-left" aria-hidden="true" /> Retour</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ k: 'all', l: `Tout (${answers.length})` }, { k: 'wrong', l: `❌ Incorrectes (${wrong.length})` }, { k: 'correct', l: `✅ Correctes (${correct.length})` }].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${filter === f.k ? '#3b82f6' : '#e2e8f0'}`, background: filter === f.k ? '#eff6ff' : '#fff', color: filter === f.k ? '#1d4ed8' : '#64748b' }}>
              {f.l}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{ flex: 1, minWidth: 160, padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
      </div>

      {/* Answer list */}
      {filtered.map(a => {
        const ex = expand === a.id;
        const secs = parseExpl(a.explanation);
        return (
          <div key={a.id} style={{ border: `1px solid ${a.is_correct ? '#86efac' : '#fca5a5'}`, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
            <div onClick={() => setExpand(ex ? null : a.id)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', background: a.is_correct ? '#f0fdf4' : '#fef2f2' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, color: a.is_correct ? '#15803d' : '#b91c1c', border: `1px solid ${a.is_correct ? '#86efac' : '#fca5a5'}` }}>
                {a.is_correct ? '✓' : '✗'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge text={`Q${a.question_num}`} variant={a.is_correct ? 'green' : 'red'} />
                  {a.question_type === 'multi' && <Badge text="QCM" variant="amber" />}
                  {a.question_type === 'match' && <Badge text="Appariement" variant="amber" />}
                  {a.question_type === 'single' && a.selected_letter && <span className="text-muted text-small">Vous : <strong style={{ color: a.is_correct ? '#15803d' : '#b91c1c' }}>{a.selected_letter}</strong></span>}
                  {a.question_type === 'single' && !a.is_correct && a.correct_letter && <span className="text-muted text-small">Correct : <strong style={{ color: '#15803d' }}>{a.correct_letter}</strong></span>}
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{a.question_text.length > 160 && !ex ? a.question_text.slice(0, 160) + '…' : a.question_text}</p>
              </div>
              <span className="text-muted text-small" style={{ flexShrink: 0 }}>{ex ? '▲' : '▼'}</span>
            </div>

            {ex && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid #f1f5f9' }}>
                {/* Correction appariement */}
                {a.question_type === 'match' && a.matchPairs?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#94a3b8', marginBottom: 8 }}>Correspondances</div>
                    {a.matchPairs.map((p, i) => {
                      const userResp = a.answer_data?.pairs?.[p.left_text] || null;
                      const ok = userResp === p.right_text;
                      return (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '9px 12px', borderRadius: 8, border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`, background: ok ? '#f0fdf4' : '#fef2f2', marginBottom: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, flex: '1 1 160px' }}>{p.left_text}</span>
                          <span style={{ fontSize: 13, flex: '2 1 240px' }}>
                            <span style={{ color: ok ? '#15803d' : '#b91c1c' }}>{ok ? '✓' : '✗'} {userResp || <em style={{ color: '#94a3b8' }}>(vide)</em>}</span>
                            {!ok && <span style={{ display: 'block', color: '#15803d', marginTop: 2 }}>➜ {p.right_text}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Correction choix unique / multiples */}
                {a.question_type !== 'match' && a.options?.length > 0 && (() => {
                  const selLetters = a.question_type === 'multi'
                    ? (a.answer_data?.selectedLetters || [])
                    : (a.selected_letter ? [a.selected_letter] : []);
                  return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#94a3b8', marginBottom: 8 }}>Options</div>
                    {a.options.map(opt => {
                      const isc = opt.is_correct;
                      const iss = selLetters.includes(opt.letter);
                      return (
                        <div key={opt.letter} style={{ display: 'flex', gap: 10, padding: '9px 12px', borderRadius: 8, border: `1px solid ${isc ? '#86efac' : iss ? '#fca5a5' : '#e2e8f0'}`, background: isc ? '#f0fdf4' : iss ? '#fef2f2' : '#fff', marginBottom: 5, alignItems: 'flex-start' }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: isc ? '#f0fdf4' : iss ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isc ? '#15803d' : iss ? '#b91c1c' : '#64748b', flexShrink: 0 }}>{opt.letter}</div>
                          <span style={{ fontSize: 13, lineHeight: 1.5, flex: 1 }}>
                            {opt.option_text}
                            {isc && <span style={{ marginLeft: 8, fontSize: 11, color: '#15803d', fontWeight: 700 }}> ✓ Correct</span>}
                            {iss && !isc && <span style={{ marginLeft: 8, fontSize: 11, color: '#b91c1c', fontWeight: 700 }}> ✗ Votre réponse</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}
                {a.explanation && (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#94a3b8', marginBottom: 10 }}>Explication · Analyse BARAKUDA</div>
                    {secs.length > 0 ? secs.map((s, i) => (
                      <div key={i} style={s.hdr ? { borderLeft: '3px solid #3b82f6', padding: '8px 12px', background: '#f8fafc', borderRadius: '0 8px 8px 0', marginBottom: 8 } : { marginBottom: 5 }}>
                        {s.hdr && <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 3 }}>{s.hdr}</div>}
                        {s.lines.map((l, j) => <p key={j} style={{ fontSize: 13, color: '#475569', lineHeight: 1.65, margin: j < s.lines.length - 1 ? '0 0 4px' : 0 }}>{l}</p>)}
                      </div>
                    )) : <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{a.explanation}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
