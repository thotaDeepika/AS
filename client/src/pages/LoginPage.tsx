import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg"><div className="login-bg-gradient" /><div className="login-bg-pattern" /></div>
      <div className="login-container">
        <div className="login-branding">
          <div className="login-branding-content">
            <div className="login-logo">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="url(#lg)" />
                <path d="M14 34V14h12a8 8 0 010 16H20v4h-6zm6-10h6a2 2 0 000-4h-6v4z" fill="white"/>
                <defs><linearGradient id="lg" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
              </svg>
            </div>
            <h1 className="login-title">Faculty Appraisal<br/>& Increment System</h1>
            <p className="login-subtitle">Ramaiah Institute of Technology, Bangalore</p>
            <div className="login-features">
              {['Automated Score Calculation','Multi-level Review Workflow','Digital Proof Management'].map(f=>(
                <div className="login-feature" key={f}>
                  <div className="login-feature-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="login-form-header"><h2>Welcome back</h2><p>Sign in to your account to continue</p></div>
            {error && <div className="login-error" role="alert"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg><span>{error}</span></div>}
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                  <input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@rit.edu" required autoComplete="email" autoFocus />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                  <input id="password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
                  <button type="button" className="password-toggle" onClick={()=>setShowPassword(!showPassword)} tabIndex={-1}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                  </button>
                </div>
              </div>
              <button type="submit" className="login-btn" disabled={isLoading}>
                {isLoading ? <span className="login-btn-loading"><svg className="spinner" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="50" strokeLinecap="round"/></svg>Signing in...</span> : 'Sign in'}
              </button>
            </form>
            <div className="login-help"><p>Test: <code>admin@rit.edu</code> / <code>Admin@123</code></p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
