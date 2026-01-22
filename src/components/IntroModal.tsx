'use client';

import { useState, useEffect } from 'react';

interface IntroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IntroModal({ isOpen, onClose }: IntroModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay for animation
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
        isVisible ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-700 px-6 py-8 text-center relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-400/20 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Task Pulse</h2>
            <p className="text-teal-100 text-sm leading-relaxed max-w-xs mx-auto">
              See where things are, who's on it, and when it's your turn — all in one place.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">How it works</h3>

          {/* Pipeline visualization */}
          <div className="flex items-center justify-center gap-1 mb-6">
            {['Step 1', 'Step 2', 'Step 3'].map((step, i) => (
              <div key={step} className="flex items-center">
                <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
                  i === 0
                    ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400/50'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  <div className="text-[10px] text-slate-400 mb-0.5">{step}</div>
                  <div>{i === 0 ? 'You' : i === 1 ? 'Alex' : 'Sam'}</div>
                </div>
                {i < 2 && (
                  <svg className="w-4 h-4 text-slate-300 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
            <svg className="w-4 h-4 text-slate-300 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              Each task has steps, and each step has an owner.
            </p>
            <p>
              When you're done, hit <span className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium text-xs">Complete</span> — it moves to the next person. Leave a note if they need context.
            </p>
            <p>
              When it's your turn, you'll get a notification.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleClose}
            className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-medium py-3 px-4 rounded-xl hover:from-teal-700 hover:to-emerald-700 transition-all shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2"
          >
            Got it
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
