'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signUp, resetPassword, isEmailAllowed, requestAccess, getBusinessByJoinCode } from '@/lib/auth';

type AuthMode = 'signin' | 'signup' | 'reset' | 'request';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInvite = searchParams.get('invite') === 'true';
  const inviteEmail = searchParams.get('email') || '';

  const [mode, setMode] = useState<AuthMode>(isInvite ? 'signup' : 'signin');
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState('');
  const [businessCode, setBusinessCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'signin') {
        const allowed = await isEmailAllowed(email);
        if (!allowed) {
          setError('This email is not registered. Request access first.');
          setLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        } else {
          router.push('/select-business');
        }
      } else if (mode === 'signup') {
        const allowed = await isEmailAllowed(email);
        if (!allowed) {
          // Email not in members - auto-submit access request
          const { error: requestError } = await requestAccess(email);
          if (requestError) {
            if (requestError.code === '23505') {
              setError('Access request already submitted. Please wait for approval.');
            } else {
              setError(requestError.message);
            }
          } else {
            setSuccess('Access request submitted! You\'ll be notified when an admin approves your account.');
          }
          setLoading(false);
          return;
        }

        const { data, error } = await signUp(email, password);
        if (error) {
          setError(error.message);
        } else if (data?.session) {
          // Auto-confirmed — redirect straight to dashboard
          router.push('/select-business');
        } else {
          setSuccess('Account created! You can now sign in.');
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message);
        } else {
          setSuccess('Password reset link sent to your email.');
        }
      } else if (mode === 'request') {
        if (!businessCode.trim()) {
          setError('Please enter the business code provided by your admin.');
          setLoading(false);
          return;
        }

        const { error } = await requestAccess(email, businessCode);
        if (error) {
          if (error.code === '23505') {
            setError('Access request already submitted.');
          } else if (error.code === 'INVALID_CODE') {
            setError('Invalid business code. Please check with your admin.');
          } else {
            setError(error.message);
          }
        } else {
          setSuccess('Access request submitted. You will be notified when approved.');
        }
      }
    } catch {
      setError('An unexpected error occurred.');
    }

    setLoading(false);
  };

  return (
    <div className="glass-bg min-h-screen flex items-center justify-center p-4 futuristic-grid">
      <div className="glass-card rounded-xl p-8 w-full max-w-md animate-in relative overflow-hidden">
        {/* Decorative gradient orb */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-teal-400/20 to-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-amber-400/10 to-orange-400/5 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="text-center mb-8 relative">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Task Pulse</h1>
          <p className="text-gray-500 mt-2">Pipeline-based task management</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === 'signin'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === 'signup'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => { setMode('request'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === 'request'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Request Access
          </button>
        </div>

        {/* Invite welcome banner */}
        {isInvite && mode === 'signup' && (
          <div className="bg-teal-50 border border-teal-200 text-teal-800 p-3 rounded-lg text-sm mb-4">
            <strong>Welcome!</strong> You&apos;ve been invited to Task Pulse. Choose a password below to complete your account setup.
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@company.com"
              required
            />
          </div>

          {(mode === 'signin' || mode === 'signup') && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === 'request' && (
            <div>
              <label htmlFor="businessCode" className="block text-sm font-medium text-gray-700 mb-1">
                Business Code
              </label>
              <input
                id="businessCode"
                type="text"
                value={businessCode}
                onChange={async (e) => {
                  const code = e.target.value.toUpperCase();
                  setBusinessCode(code);
                  setBusinessName('');
                  if (code.length >= 6) {
                    const { data } = await getBusinessByJoinCode(code);
                    if (data) setBusinessName(data.name);
                  }
                }}
                className="input-field uppercase"
                placeholder="e.g. ABC123"
                maxLength={10}
                required
              />
              {businessName && (
                <p className="text-sm text-teal-600 mt-1">Joining: {businessName}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Ask your admin for the business code</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading && <span className="spinner" />}
            {mode === 'signin' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'reset' && 'Send Reset Link'}
            {mode === 'request' && 'Request Access'}
          </button>
        </form>

        {/* Forgot password link */}
        {mode === 'signin' && (
          <div className="mt-4 text-center">
            <button
              onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              Forgot your password?
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <div className="mt-4 text-center">
            <button
              onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              Back to sign in
            </button>
          </div>
        )}

        {/* Cabin branding */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <a
            href="https://cabin.com.sg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600 transition-colors"
          >
            <img src="/cabin-logo.png" alt="Cabin" className="h-6 w-auto" />
            <span>A Cabin Tool</span>
          </a>
        </div>
      </div>
    </div>
  );
}
