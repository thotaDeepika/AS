import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'login' | 'forgot' | 'reset'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccessMessage(response.data.message || 'OTP sent successfully.');
      setView('reset');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to request OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/reset-password', { email, otp, newPassword });
      setSuccessMessage(response.data.message || 'Password reset successful. You can now login.');
      setView('login');
      setPassword('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to reset password. Please try again.');
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
              <img 
                src="/ramaiahlogo.jpeg" 
                alt="Ramaiah Logo" 
                style={{ 
                  width: '64px', 
                  height: '64px', 
                  objectFit: 'contain', 
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  padding: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }} 
              />
            </div>
            <h1 className="login-title">Faculty Appraisal<br/>& Increment System</h1>
            <p className="login-subtitle">Ramaiah Institute of Technology, Bangalore</p>

          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-form-wrapper">
            {view === 'login' && (
              <>
                <div className="login-form-header"><h2>Welcome back</h2><p>Sign in to your account to continue</p></div>
                {successMessage && (
                  <div className="login-success-banner" style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{successMessage}</span>
                  </div>
                )}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                      <button type="button" className="forgot-password-link" style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '13px', cursor: 'pointer', padding: 0, fontWeight: 500 }} onClick={() => { setError(''); setSuccessMessage(''); setView('forgot'); }}>
                        Forgot Password?
                      </button>
                    </div>
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
              </>
            )}

            {view === 'forgot' && (
              <>
                <div className="login-form-header">
                  <h2>Forgot Password?</h2>
                  <p>Enter your registered email address to receive a 6-digit OTP code.</p>
                </div>
                {error && <div className="login-error" role="alert"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg><span>{error}</span></div>}
                <form onSubmit={handleForgotPassword} className="login-form">
                  <div className="form-group">
                    <label htmlFor="forgot-email">Email Address</label>
                    <div className="input-wrapper">
                      <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                      <input id="forgot-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@rit.edu" required autoComplete="email" autoFocus />
                    </div>
                  </div>
                  <button type="submit" className="login-btn" disabled={isLoading}>
                    {isLoading ? <span className="login-btn-loading"><svg className="spinner" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="50" strokeLinecap="round"/></svg>Sending OTP...</span> : 'Send OTP'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button type="button" style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setError(''); setSuccessMessage(''); setView('login'); }}>
                      ← Back to Sign In
                    </button>
                  </div>
                </form>
              </>
            )}

            {view === 'reset' && (
              <>
                <div className="login-form-header">
                  <h2>Reset Password</h2>
                  <p>Enter the 6-digit OTP code sent to <strong>{email}</strong> and configure your new password.</p>
                </div>
                {successMessage && (
                  <div className="login-success-banner" style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{successMessage}</span>
                  </div>
                )}
                {error && <div className="login-error" role="alert"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg><span>{error}</span></div>}
                <form onSubmit={handleResetPassword} className="login-form">
                  <div className="form-group">
                    <label htmlFor="otp">6-Digit OTP Code</label>
                    <div className="input-wrapper">
                      <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style={{ color: '#9ca3af' }}><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                      <input id="otp" type="text" maxLength={6} pattern="\d{6}" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456" required autoFocus style={{ letterSpacing: '2px', fontWeight: 'bold' }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-password">New Password</label>
                    <div className="input-wrapper">
                      <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                      <input id="new-password" type={showPassword?'text':'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="••••••••" required />
                      <button type="button" className="password-toggle" onClick={()=>setShowPassword(!showPassword)} tabIndex={-1}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="confirm-password">Confirm Password</label>
                    <div className="input-wrapper">
                      <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                      <input id="confirm-password" type={showPassword?'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                  </div>
                  <button type="submit" className="login-btn" disabled={isLoading}>
                    {isLoading ? <span className="login-btn-loading"><svg className="spinner" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="50" strokeLinecap="round"/></svg>Resetting...</span> : 'Reset Password'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                    <button type="button" style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setError(''); setSuccessMessage(''); setView('forgot'); }}>
                      ← Request New OTP
                    </button>
                    <span style={{ color: '#d1d5db' }}>|</span>
                    <button type="button" style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setError(''); setSuccessMessage(''); setView('login'); }}>
                      Sign In
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

