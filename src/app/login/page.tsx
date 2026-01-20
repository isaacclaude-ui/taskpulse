'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, resetPassword, isEmailAllowed, requestAccess, getBusinessByJoinCode } from '@/lib/auth';

type AuthMode = 'signin' | 'signup' | 'reset' | 'request';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessCode, setBusinessCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

        const { error } = await signUp(email, password);
        if (error) {
          setError(error.message);
        } else {
          setSuccess('Check your email to confirm your account.');
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
    <div className="glass-bg min-h-screen flex items-center justify-center p-4">
      <div className="glass-card rounded-xl p-8 w-full max-w-md animate-in">
        {/* Logo */}
        <div className="text-center mb-8">
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
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                minLength={6}
              />
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
      </div>
    </div>
  );
}
