import React, { useEffect, useState } from 'react';
import api from '../api';
import { ProgressBar } from '../components/UI';

export default function Landing({ onNavigate }) {
  const [stats, setStats] = useState({ exams: 2, questions: 360, users: 0, attempts: 0, avgScore: 0, passRate: 0 });

  useEffect(() => {
    api.get('/exams/public/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)', borderBottom: '1px solid #e2e8f0', padding: '72px 16px 60px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', background: '#fff', border: '1px solid #bfdbfe', borderRadius: 99, fontSize: 12, color: '#1d4ed8', fontWeight: 600, marginBottom: 20 }}>
            <i className="ti ti-certificate" aria-hidden="true" /> Certification PMI · PMBOK 7
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1, marginBottom: 16, lineHeight: 1.2, color: '#0f172a' }}>
            Préparez votre PMP avec<br/>des examens blancs complets
          </h1>
          <p style={{ fontSize: 16, color: '#475569', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.75 }}>
            360 questions officielles, analyse BARAKUDA détaillée, suivi de progression personnalisé.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 15 }} onClick={() => onNavigate('register')}>
              <i className="ti ti-user-plus" aria-hidden="true" /> S'inscrire gratuitement
            </button>
            <button className="btn" style={{ padding: '12px 28px', fontSize: 15 }} onClick={() => onNavigate('login')}>
              <i className="ti ti-login" aria-hidden="true" /> Se connecter
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Stats */}
        <div style={{ padding: '40px 0 0' }}>
          <div className="grid-4" style={{ marginBottom: 48 }}>
            {[
              { icon: 'ti-books',      v: stats.exams,     l: 'Examens officiels' },
              { icon: 'ti-help-circle',v: stats.questions, l: 'Questions PMBOK 7' },
              { icon: 'ti-users',      v: stats.users,     l: 'Candidats actifs' },
              { icon: 'ti-target',     v: stats.avgScore ? `${stats.avgScore}%` : '—', l: 'Score moyen' },
            ].map(({ icon, v, l }) => (
              <div key={l} className="stat-box">
                <i className={`ti ${icon}`} style={{ fontSize: 24, color: '#94a3b8' }} aria-hidden="true" />
                <div className="stat-box-n">{v}</div>
                <div className="stat-box-l">{l}</div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="grid-3" style={{ marginBottom: 48 }}>
            {[
              { icon: 'ti-checklist', title: 'Examens complets', desc: '180 questions par examen — mode personnalisé, mélange aléatoire, navigation libre' },
              { icon: 'ti-chart-bar', title: 'Analyse BARAKUDA', desc: 'Explication structurée de chaque question : domaine PMP, pourquoi votre réponse est bonne ou mauvaise' },
              { icon: 'ti-shield-check', title: 'Accès sécurisé', desc: 'Inscription validée par un administrateur avant activation — suivi individuel des résultats' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="card">
                <i className={`ti ${icon}`} style={{ fontSize: 28, color: '#94a3b8', display: 'block', marginBottom: 12 }} aria-hidden="true" />
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{title}</h3>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Pass rate */}
          {stats.attempts > 0 && (
            <div className="card" style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto 48px' }}>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                Taux de réussite global — {stats.attempts} tentative{stats.attempts !== 1 ? 's' : ''}
              </p>
              <ProgressBar value={stats.passRate} max={100} style={{ maxWidth: 320, margin: '0 auto 10px' }} />
              <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d' }}>{stats.passRate}%</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
