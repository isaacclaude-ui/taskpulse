'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { useNav } from '@/context/NavContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string | null;
  is_read: boolean;
  is_addressed: boolean;
  created_at: string;
  task: { id: string; title: string } | null;
  step: { id: string; name: string } | null;
  creator: { id: string; name: string } | null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { member, business, team } = useNav();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'inbox' | 'archived'>('inbox');
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      if (!member) {
        router.push('/select-business');
        return;
      }
      loadNotifications();
    }
    checkAuth();
  }, [router, member]);

  useEffect(() => {
    if (member) {
      loadNotifications();
    }
  }, [filter, member]);

  const loadNotifications = async () => {
    if (!member) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        memberId: member.id,
        filter,
        limit: '100',
      });

      const res = await fetch(`/api/notifications?${params}`);
      const data = await res.json();

      if (res.ok) {
        setNotifications(data.notifications || []);
        setInboxCount(data.inboxCount || 0);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
    setLoading(false);
  };

  const handleMarkAddressed = async (notificationId: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, markAddressed: true }),
      });

      if (res.ok) {
        // Remove from current view
        setNotifications(notifications.filter(n => n.id !== notificationId));
        setInboxCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark as addressed:', error);
    }
  };

  const handleUnmarkAddressed = async (notificationId: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, unmarkAddressed: true }),
      });

      if (res.ok) {
        // Remove from current view (archived)
        setNotifications(notifications.filter(n => n.id !== notificationId));
        setInboxCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to move to inbox:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="glass-bg min-h-screen">
      {/* Header */}
      <header className="header-banner">
        <div className="header-banner-content px-4 py-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-white/80 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Notifications</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-teal-100 text-sm">{business?.name}</span>
                  <span className="text-teal-300">•</span>
                  <span className="text-white text-sm font-medium">{member?.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Filter tabs */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setFilter('inbox')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              filter === 'inbox'
                ? 'bg-teal-100 text-teal-800'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Active
            {inboxCount > 0 && (
              <span className="bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full">
                {inboxCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              filter === 'archived'
                ? 'bg-teal-100 text-teal-800'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Addressed
          </button>
        </div>

        {/* Notifications list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {filter === 'inbox' ? 'All caught up!' : 'Nothing here yet'}
            </h3>
            <p className="text-gray-500">
              {filter === 'inbox'
                ? 'No active notifications'
                : 'Addressed notifications will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`glass-card rounded-xl p-4 transition-all ${
                  !notification.is_read ? 'border-l-4 border-teal-500' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    notification.type === 'mention' ? 'bg-blue-100 text-blue-600' :
                    notification.type === 'return' ? 'bg-amber-100 text-amber-600' :
                    'bg-teal-100 text-teal-600'
                  }`}>
                    {notification.type === 'mention' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    ) : notification.type === 'return' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-sm ${!notification.is_read ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                          {notification.title}
                        </p>
                        {notification.content && (
                          <p className="text-sm text-gray-600 mt-1">{notification.content}</p>
                        )}
                        {/* Context info */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {notification.creator && (
                            <span>From: {notification.creator.name}</span>
                          )}
                          {notification.task && (
                            <span className="truncate max-w-[200px]" title={notification.task.title}>
                              Pipeline: {notification.task.title}
                            </span>
                          )}
                          {notification.step && (
                            <span className="truncate max-w-[150px]" title={notification.step.name}>
                              Step: {notification.step.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="flex-shrink-0 text-right">
                        <span
                          className="text-xs text-gray-400"
                          title={formatFullDate(notification.created_at)}
                        >
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                      {notification.task && (
                        <button
                          onClick={() => router.push(`/dashboard`)}
                          className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                        >
                          View Pipeline
                        </button>
                      )}
                      {filter === 'inbox' ? (
                        <button
                          onClick={() => handleMarkAddressed(notification.id)}
                          className="text-xs text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Mark Addressed
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnmarkAddressed(notification.id)}
                          className="text-xs text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Move to Inbox
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
