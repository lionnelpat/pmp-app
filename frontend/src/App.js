import React, { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import { LoginPage, RegisterPage } from './pages/Auth';
import AdminPage from './pages/Admin';
import { DashboardPage, ConfigPage, QuizPage, ResultsPage } from './pages/Quiz';
import { Spinner } from './components/UI';
import api from './api';
import './index.css';

function Router() {
  const { user, loading } = useAuth();
  const [page,        setPage]        = useState('landing');
  const [selectedExam, setSelectedExam] = useState(null);
  const [activeAttempt, setActiveAttempt] = useState(null); // {id, questions, candidateName}
  const [pendingCount, setPendingCount]   = useState(0);

  function navigate(target, data) {
    setPage(target);
    if (data) setSelectedExam(data);
  }

  // After login, redirect to correct screen
  function handleLogin(target) {
    setPage(target);
  }

  // Start exam: create attempt, load questions, go to quiz
  async function startExam({ examId, candidateName, questionCount, shuffled }) {
    try {
      const attRes = await api.post('/attempts', { examId, candidateName, questionCount, shuffled });
      const qRes   = await api.get(`/exams/${examId}/questions`, { params: { limit: questionCount, shuffle: shuffled } });
      setActiveAttempt({
        id: attRes.data.attemptId,
        questions: qRes.data,
        candidateName,
        timeLimitSeconds: attRes.data.timeLimitSeconds,
        startedAt: attRes.data.startedAt,
      });
      setPage('quiz');
    } catch (err) {
      alert('Erreur lors du démarrage : ' + (err.response?.data?.error || err.message));
    }
  }

  async function abandonAttempt() {
    if (!window.confirm('Abandonner cet examen ? La tentative ne sera pas enregistrée.')) return;
    if (activeAttempt?.id) {
      await api.delete(`/attempts/${activeAttempt.id}`).catch(() => {});
    }
    setActiveAttempt(null);
    setPage('dashboard');
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><Spinner /></div>;

  // Guard: redirect to landing if not logged in and trying to access protected pages
  const protectedPages = ['dashboard', 'config', 'quiz', 'results', 'admin'];
  if (!user && protectedPages.includes(page)) {
    return (
      <>
        <Navbar onNavigate={navigate} currentPage="login" pendingCount={0} />
        <LoginPage onNavigate={handleLogin} />
      </>
    );
  }

  // Guard: redirect to dashboard if logged in and trying to access auth pages
  if (user && (page === 'landing' || page === 'login' || page === 'register')) {
    const target = user.role === 'admin' ? 'admin' : 'dashboard';
    if (page !== target) {
      setTimeout(() => setPage(target), 0);
    }
  }

  return (
    <>
      <Navbar onNavigate={navigate} currentPage={page} pendingCount={pendingCount} />

      {page === 'landing'  && <Landing onNavigate={navigate} />}
      {page === 'login'    && <LoginPage onNavigate={handleLogin} />}
      {page === 'register' && <RegisterPage onNavigate={navigate} />}

      {page === 'admin' && user?.role === 'admin' && (
        <AdminPage onNavigate={navigate} onPendingChange={setPendingCount} />
      )}

      {page === 'dashboard' && user && (
        <DashboardPage onNavigate={(p, data) => { if (data) setSelectedExam(data); setPage(p); }} />
      )}

      {page === 'config' && user && selectedExam && (
        <ConfigPage
          exam={selectedExam}
          onStart={startExam}
          onBack={() => setPage('dashboard')}
        />
      )}

      {page === 'quiz' && activeAttempt && (
        <QuizPage
          attemptId={activeAttempt.id}
          questions={activeAttempt.questions}
          candidateName={activeAttempt.candidateName}
          timeLimitSeconds={activeAttempt.timeLimitSeconds}
          startedAt={activeAttempt.startedAt}
          onFinish={(id) => { setActiveAttempt(null); setPage('results'); setActiveAttempt({ id }); }}
          onAbandon={abandonAttempt}
        />
      )}

      {page === 'results' && activeAttempt?.id && (
        <ResultsPage
          attemptId={activeAttempt.id}
          onRetry={() => { setPage('config'); }}
          onBack={() => setPage('dashboard')}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
