import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Spinner, StatusBadge, Badge, GradeBadge, ProgressBar } from '../components/UI';
import { useAuth } from '../context/AuthContext';

export default function AdminPage({ onNavigate, onPendingChange }) {
  const { logout } = useAuth();
  const [tab, setTab]     = useState('pending');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importErr, setImportErr] = useState('');

  const loadUsers = useCallback(() =>
    api.get('/admin/users').then(r => { setUsers(r.data); onPendingChange(r.data.filter(u => u.status === 'pending').length); }),
    [onPendingChange]);

  useEffect(() => {
    if (tab === 'users' || tab === 'pending') loadUsers();
    if (tab === 'stats')  api.get('/admin/stats').then(r => setStats(r.data));
    if (tab === 'exams')  api.get('/exams').then(r => setExams(r.data));
  }, [tab, loadUsers]);

  async function updateStatus(id, status) {
    await api.patch(`/admin/users/${id}/status`, { status });
    loadUsers();
  }
  async function deleteUser(id) {
    if (!window.confirm('Supprimer cet utilisateur définitivement ?')) return;
    await api.delete(`/admin/users/${id}`);
    loadUsers();
  }

  const pending = users.filter(u => u.status === 'pending');

  const tabs = [
    { k: 'pending', icon: 'ti-clock',     l: 'En attente',   n: pending.length, alert: true },
    { k: 'users',   icon: 'ti-users',     l: 'Utilisateurs', n: users.length },
    { k: 'stats',   icon: 'ti-chart-bar', l: 'Statistiques', n: null },
    { k: 'exams',   icon: 'ti-books',     l: 'Examens',      n: null },
  ];

  function fmt(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  return (
    <div className="container page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Administration</h1>
          <p className="text-muted text-small">Panneau de gestion PMP Quiz</p>
        </div>
        <button className="btn btn-sm" onClick={logout}><i className="ti ti-logout" aria-hidden="true" /> Déconnexion</button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.k} className={`tab-btn ${tab === t.k ? 'active' : ''}`} onClick={() => setTab(t.k)}>
            <i className={`ti ${t.icon}`} aria-hidden="true" /> {t.l}
            {t.n !== null && <span className={`badge ${t.alert && t.n > 0 ? 'badge-amber' : 'badge-gray'}`}>{t.n}</span>}
          </button>
        ))}
      </div>

      {/* PENDING */}
      {tab === 'pending' && (
        <div>
          {pending.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 36 }}>
              <i className="ti ti-check" style={{ fontSize: 32, color: '#22c55e' }} aria-hidden="true" />
              <p className="text-muted" style={{ marginTop: 8 }}>Aucune inscription en attente</p>
            </div>
          ) : pending.map(u => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>
                {u.full_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div className="fw-600">{u.full_name}</div>
                <div className="text-muted text-small">@{u.username} · {u.email}</div>
                <div className="text-muted text-small">Inscrit le {fmt(u.created_at)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success btn-sm" onClick={() => updateStatus(u.id, 'active')}>
                  <i className="ti ti-check" aria-hidden="true" /> Valider
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => updateStatus(u.id, 'rejected')}>
                  <i className="ti ti-x" aria-hidden="true" /> Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div>
          {users.length === 0 ? <Spinner /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Utilisateur</th><th>Email</th><th>Statut</th><th>Inscrit le</th><th>Tentatives</th><th>Meilleur</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td><div className="fw-600">{u.full_name}</div><div className="text-muted text-small">@{u.username}</div></td>
                      <td className="text-muted">{u.email}</td>
                      <td><StatusBadge status={u.status} /></td>
                      <td className="text-muted text-small">{fmt(u.created_at)}</td>
                      <td style={{ textAlign: 'center' }}>{u.attempt_count || 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        {u.best_score != null ? <span className="fw-600" style={{ color: u.best_score >= 75 ? '#15803d' : u.best_score >= 61 ? '#92400e' : '#b91c1c' }}>{u.best_score}%</span> : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {u.status === 'pending'  && <button className="btn btn-success btn-sm" onClick={() => updateStatus(u.id, 'active')}><i className="ti ti-check" aria-hidden="true" /></button>}
                          {u.status === 'active'   && <button className="btn btn-danger  btn-sm" onClick={() => updateStatus(u.id, 'blocked')}><i className="ti ti-ban" aria-hidden="true" /></button>}
                          {u.status === 'blocked'  && <button className="btn btn-success btn-sm" onClick={() => updateStatus(u.id, 'active')}><i className="ti ti-lock-open" aria-hidden="true" /></button>}
                          {u.status === 'rejected' && <button className="btn btn-sm"            onClick={() => updateStatus(u.id, 'active')}><i className="ti ti-refresh" aria-hidden="true" /></button>}
                          <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}><i className="ti ti-trash" aria-hidden="true" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* STATS */}
      {tab === 'stats' && (
        !stats ? <Spinner /> : (
          <div>
            <div className="grid-4 mb-24">
              {[
                { icon: 'ti-users',       v: stats.users,    l: 'Candidats inscrits' },
                { icon: 'ti-user-check',  v: stats.active,   l: 'Comptes actifs' },
                { icon: 'ti-clock',       v: stats.pending,  l: 'En attente', alert: true },
                { icon: 'ti-writing',     v: stats.attempts, l: 'Tentatives terminées' },
              ].map(s => (
                <div key={s.l} className="stat-box">
                  <i className={`ti ${s.icon}`} style={{ fontSize: 22, color: s.alert && s.v > 0 ? '#d97706' : '#94a3b8' }} aria-hidden="true" />
                  <div className="stat-box-n" style={{ color: s.alert && s.v > 0 ? '#d97706' : undefined }}>{s.v}</div>
                  <div className="stat-box-l">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="grid-2">
              {(stats.examStats || []).map(e => (
                <div key={e.id} className="card">
                  <div className="fw-600 mb-8">{e.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="text-muted text-small">{e.attempt_count} tentative{e.attempt_count !== 1 ? 's' : ''}</span>
                    {e.attempt_count > 0 && <span className="fw-600" style={{ color: e.avg_score >= 75 ? '#15803d' : e.avg_score >= 61 ? '#d97706' : '#b91c1c' }}>Moy. {e.avg_score}%</span>}
                  </div>
                  {e.attempt_count > 0 && (
                    <>
                      <ProgressBar value={e.pass_count} max={e.attempt_count} />
                      <div className="text-muted text-small" style={{ marginTop: 4 }}>
                        Taux de réussite : {Math.round(e.pass_count / e.attempt_count * 100)}%
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* EXAMS */}
      {tab === 'exams' && (
        <div>
          {importErr && <div className="alert alert-err mb-16">{importErr}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Examens ({exams.length})</h2>
            <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
              <i className="ti ti-upload" aria-hidden="true" /> Importer JSON
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files[0]; if (!file) return;
                setImportErr('');
                try {
                  const fd = new FormData();
                  fd.append('file', file);
                  fd.append('name', file.name.replace(/\.json$/i, '').replace(/_/g, ' '));
                  await api.post('/exams/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                  const r = await api.get('/exams'); setExams(r.data);
                } catch (err) { setImportErr(err.response?.data?.error || 'Erreur import'); }
                e.target.value = '';
              }} />
            </label>
          </div>
          {exams.map(e => (
            <div key={e.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <i className="ti ti-books" style={{ fontSize: 24, color: '#94a3b8', flexShrink: 0 }} aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <div className="fw-600">{e.name}</div>
                <div className="text-muted text-small">{e.question_count} questions · {e.attempt_count} tentative{e.attempt_count !== 1 ? 's' : ''}</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={async () => {
                if (!window.confirm('Supprimer cet examen et toutes ses tentatives ?')) return;
                await api.delete(`/exams/${e.id}`);
                setExams(p => p.filter(x => x.id !== e.id));
              }}>
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
