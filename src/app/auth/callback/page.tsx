'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash fragment parameters (Supabase appends tokens here)
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace('#', ''));
        const type = params.get('type');

        // Let Supabase client process the URL tokens automatically
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          setStatus('Authentication error. Redirecting to login...');
          setTimeout(() => router.push('/login'), 2000);
          return;
        }

        if (type === 'recovery') {
          // Password reset flow - redirect to reset password page
          setStatus('Verified! Setting up password reset...');
          setTimeout(() => router.push('/reset-password'), 500);
          return;
        }

        if (session) {
          // User is authenticated - redirect to app
          setStatus('Verified! Redirecting to dashboard...');
          setTimeout(() => router.push('/select-business'), 500);
        } else {
          // No session yet - might be email confirmation
          // Try to get session again after a brief delay (token processing)
          setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              router.push('/select-business');
            } else {
              setStatus('Email confirmed! You can now sign in.');
              setTimeout(() => router.push('/login'), 2000);
            }
          }, 1000);
        }
      } catch {
        setStatus('Something went wrong. Redirecting to login...');
        setTimeout(() => router.push('/login'), 2000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="glass-bg min-h-screen flex items-center justify-center p-4">
      <div className="glass-card rounded-xl p-8 w-full max-w-md text-center animate-in">
        <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <div className="spinner mx-auto mb-4" />
        <p className="text-gray-600 text-sm">{status}</p>
      </div>
    </div>
  );
}
