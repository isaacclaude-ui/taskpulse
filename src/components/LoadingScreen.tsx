'use client';

import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  message?: string;
  delay?: number; // Delay before showing (prevents flicker on fast loads)
}

export default function LoadingScreen({ message = 'Loading', delay = 400 }: LoadingScreenProps) {
  const [dots, setDots] = useState('');
  const [show, setShow] = useState(false);

  // Only show loading screen after delay (prevents flicker on fast page loads)
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Don't render anything until delay has passed
  if (!show) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 flex items-center justify-center">
      <div className="text-center">
        {/* Animated logo/icon */}
        <div className="relative mb-8">
          <div className="w-16 h-16 mx-auto">
            {/* Outer ring - rotating */}
            <div className="absolute inset-0 border-4 border-white/20 rounded-full animate-[spin_3s_linear_infinite]" />
            {/* Inner ring - counter rotating */}
            <div className="absolute inset-2 border-4 border-t-white border-r-white/40 border-b-white/20 border-l-white/40 rounded-full animate-[spin_1.5s_linear_infinite_reverse]" />
            {/* Center pulse */}
            <div className="absolute inset-4 bg-white/30 rounded-full animate-pulse" />
          </div>
        </div>

        {/* App name */}
        <h1 className="text-2xl font-bold text-white mb-2 tracking-wide">
          Task Pulse
        </h1>

        {/* Loading message with animated dots */}
        <p className="text-white/80 text-sm font-medium min-w-[100px]">
          {message}<span className="inline-block w-6 text-left">{dots}</span>
        </p>

        {/* Subtle progress bar */}
        <div className="mt-6 w-48 h-1 bg-white/20 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-white/60 rounded-full animate-loading-bar" />
        </div>
      </div>
    </div>
  );
}
