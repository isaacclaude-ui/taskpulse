'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface NotificationBellProps {
  memberId: string;
}

export default function NotificationBell({ memberId }: NotificationBellProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [memberId]);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch(`/api/notifications?memberId=${memberId}&filter=inbox`);
      const data = await res.json();
      if (res.ok) {
        setUnreadCount(data.inboxCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  return (
    <button
      onClick={() => router.push('/notifications')}
      className="relative p-2 text-white/80 hover:text-white transition-colors"
      title="Notifications"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {/* Badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
