import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Badge } from './UI';

export default function Navbar({ onNavigate, currentPage, pendingCount = 0 }) {
  const { user, logout } = useAuth();

  function go(page) { onNavigate(page); }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand" onClick={() => go(user ? (user.role === 'admin' ? 'admin' : 'dashboard') : 'landing')}>
          <span style={{ fontSize: 22 }}>🎓</span>
          <span className="nav-brand-name">PMP Quiz</span>
          <Badge text="PMBOK 7 · Agile" variant="blue" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user && user.role === 'admin' && pendingCount > 0 && (
            <button className="btn btn-sm" onClick={() => go('admin')} style={{ background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}>
              <i className="ti ti-clock" aria-hidden="true" />
              {pendingCount} en attente
            </button>
          )}

          {user && currentPage !== 'quiz' && (
            <>
              {user.role !== 'admin' && (
                <button className="btn btn-sm" onClick={() => go('dashboard')}>
                  <i className="ti ti-home" aria-hidden="true" /> Accueil
                </button>
              )}
              <button className="btn btn-sm" onClick={logout}>
                <i className="ti ti-logout" aria-hidden="true" /> Déconnexion
              </button>
            </>
          )}

          {!user && (
            <>
              <button className="btn btn-sm" onClick={() => go('login')}>
                <i className="ti ti-login" aria-hidden="true" /> Connexion
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => go('register')}>
                <i className="ti ti-user-plus" aria-hidden="true" /> S'inscrire
              </button>
            </>
          )}

          {currentPage === 'quiz' && (
            <Badge text="Quiz en cours" variant="green" />
          )}
        </div>
      </div>
    </nav>
  );
}
