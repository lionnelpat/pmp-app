import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { InputField } from '../components/UI';

// ─── Login ────────────────────────────────────────────────────
export function LoginPage({ onNavigate }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(username, password);
      onNavigate(user.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 420, margin: '64px auto', padding: '0 16px' }}>
      <button className="btn btn-sm" style={{ marginBottom: 20 }} onClick={() => onNavigate('landing')}>
        <i className="ti ti-arrow-left" aria-hidden="true" /> Retour
      </button>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Connexion</h2>
          <p style={{ fontSize: 13, color: '#64748b' }}>Accédez à votre espace de préparation PMP</p>
        </div>
        {error && <div className="alert alert-err">{error}</div>}
        <form onSubmit={handleSubmit}>
          <InputField label="Identifiant ou email" icon="ti-user" value={username}
            onChange={e => setUsername(e.target.value)} placeholder="admin" autoComplete="username" required />
          <InputField label="Mot de passe" icon="ti-lock" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
            {loading ? 'Connexion…' : <><i className="ti ti-login" aria-hidden="true" /> Se connecter</>}
          </button>
        </form>
        <div className="alert alert-info" style={{ marginTop: 16, fontSize: 12 }}>
          <i className="ti ti-info-circle" aria-hidden="true" /> Admin par défaut : <code>admin</code> / <code>Admin2024!</code>
        </div>
      </div>
    </div>
  );
}

// ─── Register ─────────────────────────────────────────────────
export function RegisterPage({ onNavigate }) {
  const { register } = useAuth();
  const [form, setForm]   = useState({ fullName: '', username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone]   = useState(false);
  const [loading, setLoading] = useState(false);

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Les mots de passe ne correspondent pas');
    setLoading(true);
    try {
      await register({ fullName: form.fullName, username: form.username, email: form.email, password: form.password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'inscription');
    } finally { setLoading(false); }
  }

  if (done) return (
    <div style={{ maxWidth: 440, margin: '64px auto', padding: '0 16px' }}>
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Demande envoyée !</h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.75, marginBottom: 24 }}>
          Votre demande d'inscription a été reçue.<br/>
          Un administrateur va valider votre compte sous peu.
        </p>
        <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => onNavigate('login')}>
          <i className="ti ti-login" aria-hidden="true" /> Aller à la connexion
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 460, margin: '48px auto', padding: '0 16px' }}>
      <button className="btn btn-sm" style={{ marginBottom: 20 }} onClick={() => onNavigate('landing')}>
        <i className="ti ti-arrow-left" aria-hidden="true" /> Retour
      </button>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📝</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Créer un compte</h2>
          <p style={{ fontSize: 13, color: '#64748b' }}>Votre accès sera activé après validation par l'admin</p>
        </div>
        {error && <div className="alert alert-err">{error}</div>}
        <form onSubmit={handleSubmit}>
          <InputField label="Nom complet" icon="ti-user" value={form.fullName} onChange={f('fullName')} placeholder="Prénom Nom" required />
          <InputField label="Identifiant de connexion" icon="ti-at" value={form.username} onChange={f('username')} placeholder="ex: lionnel.ba" required />
          <InputField label="Email" icon="ti-mail" type="email" value={form.email} onChange={f('email')} placeholder="vous@example.com" required />
          <InputField label="Mot de passe (6 caractères min.)" icon="ti-lock" type="password" value={form.password} onChange={f('password')} required />
          <InputField label="Confirmer le mot de passe" icon="ti-lock-check" type="password" value={form.confirm} onChange={f('confirm')} required />
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
            {loading ? 'Envoi…' : <><i className="ti ti-send" aria-hidden="true" /> Envoyer la demande</>}
          </button>
        </form>
      </div>
    </div>
  );
}
