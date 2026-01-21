'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, signOut } from '@/lib/auth';
import { useNav } from '@/context/NavContext';
import PipelineGrid from '@/components/PipelineGrid';
import StepDetailModal from '@/components/StepDetailModal';
import TaskEditModal from '@/components/TaskEditModal';
import DashboardSummary from '@/components/DashboardSummary';
import Footer from '@/components/Footer';
import type { TaskWithSteps, Member, Team, Announcement, SharedLink, CalendarEvent, CalendarItem } from '@/types';

// Calendar display limits - generous to fill space, CSS handles overflow
const TASK_NAME_LIMIT = 30;
const STEP_NAME_LIMIT = 25;

// Helper to truncate text with ellipsis
const truncateText = (text: string, limit: number): string => {
  if (text.length <= limit) return text;
  return text.substring(0, limit - 1) + '…';
};

export default function DashboardPage() {
  const router = useRouter();
  const { teamId, team, business, member, clear, setTeamId, setTeam } = useNav();

  const [tasks, setTasks] = useState<TaskWithSteps[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'completed'>('active');
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);

  // Step detail modal state
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Task edit modal state
  const [editingTask, setEditingTask] = useState<TaskWithSteps | null>(null);

  // Announcements and Shared Links state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);

  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      if (!teamId || !member) {
        router.push('/select-business');
        return;
      }
      loadDashboard();
      loadAvailableTeams();
      loadAnnouncements();
      loadSharedLinks();
      loadCalendarEvents();
    }
    checkAuth();
  }, [router, teamId, member]);

  const loadAvailableTeams = async () => {
    if (!member) return;
    try {
      const res = await fetch(`/api/members/${member.id}/teams`);
      if (res.ok) {
        const data = await res.json();
        setAvailableTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const loadAnnouncements = async () => {
    if (!teamId) return;
    try {
      const res = await fetch(`/api/announcements?teamId=${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      }
    } catch (error) {
      console.error('Failed to load announcements:', error);
    }
  };

  const loadSharedLinks = async () => {
    if (!teamId) return;
    try {
      const res = await fetch(`/api/shared-links?teamId=${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setSharedLinks(data.links || []);
      }
    } catch (error) {
      console.error('Failed to load shared links:', error);
    }
  };

  const loadCalendarEvents = async (month?: string) => {
    if (!teamId) return;
    const targetMonth = month || calendarMonth;
    try {
      const res = await fetch(`/api/calendar-events?teamId=${teamId}&month=${targetMonth}`);
      if (res.ok) {
        const data = await res.json();
        const manualEvents = data.events || [];
        setCalendarEvents(manualEvents);

        // Merge manual events with auto deadlines from tasks
        const items: CalendarItem[] = [];

        // Add manual events
        manualEvents.forEach((e: CalendarEvent) => {
          items.push({
            id: e.id,
            event_date: e.event_date,
            title: e.title,
            color: e.color || '#0d9488',
            source: 'manual',
          });
        });

        // Add task deadlines and step mini-deadlines from loaded tasks
        tasks.forEach(task => {
          // Task deadline (pipeline deadline) - red
          if (task.deadline) {
            const deadlineDate = task.deadline.split('T')[0];
            if (deadlineDate.startsWith(targetMonth)) {
              items.push({
                id: `task-${task.id}`,
                event_date: deadlineDate,
                title: `Due: ${truncateText(task.title, TASK_NAME_LIMIT + STEP_NAME_LIMIT)}`,
                color: '#dc2626', // Red for pipeline deadlines
                source: 'task',
                task_id: task.id,
              });
            }
          }

          // Step mini-deadlines - faded red
          task.pipeline_steps?.forEach(step => {
            if (step.mini_deadline) {
              const stepDate = step.mini_deadline.split('T')[0];
              if (stepDate.startsWith(targetMonth)) {
                const taskPart = truncateText(task.title, TASK_NAME_LIMIT);
                const stepPart = truncateText(step.name, STEP_NAME_LIMIT);
                items.push({
                  id: `step-${step.id}`,
                  event_date: stepDate,
                  title: `Due: ${taskPart} - ${stepPart}`,
                  color: '#fca5a5', // Faded red for step deadlines (red-300)
                  source: 'step',
                  task_id: task.id,
                  step_id: step.id,
                });
              }
            }
          });
        });

        // Sort: step deadlines first, then pipeline (task) deadlines
        // This way pipeline deadline appears below/after step deadlines
        items.sort((a, b) => {
          // First sort by date
          if (a.event_date !== b.event_date) {
            return a.event_date.localeCompare(b.event_date);
          }
          // Same date: manual events first, then steps, then tasks (pipeline deadline last)
          const sourceOrder = { manual: 0, step: 1, task: 2 };
          return sourceOrder[a.source] - sourceOrder[b.source];
        });

        setCalendarItems(items);
      }
    } catch (error) {
      console.error('Failed to load calendar events:', error);
    }
  };

  const handleTeamSwitch = (newTeam: Team) => {
    setTeamId(newTeam.id);
    setTeam(newTeam);
  };

  useEffect(() => {
    if (teamId && member) {
      loadDashboard();
    }
  }, [filter, teamId]);

  // Refresh calendar items when tasks change (to include auto deadlines)
  useEffect(() => {
    if (tasks.length > 0) {
      loadCalendarEvents(calendarMonth);
    }
  }, [tasks]);

  const loadDashboard = async () => {
    if (!teamId || !member) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        teamId,
        memberId: member.id,
        role: member.role,
        businessId: member.business_id,
        status: filter,
      });

      const res = await fetch(`/api/dashboard?${params}`);
      const data = await res.json();

      if (res.ok) {
        setTasks(data.tasks);
        setMembers(data.members);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
    setLoading(false);
  };

  const handleStepClick = (stepId: string, taskId: string) => {
    setSelectedStepId(stepId);
    setSelectedTaskId(taskId);
  };

  const handleTaskEdit = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditingTask(task);
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Remove from local state
        setTasks(tasks.filter(t => t.id !== taskId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete pipeline');
      }
    } catch (error) {
      console.error('Delete pipeline error:', error);
      alert('Failed to delete pipeline');
    }
  };

  const handleTaskReopen = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/reopen`, {
        method: 'POST',
      });

      if (res.ok) {
        loadDashboard();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reopen pipeline');
      }
    } catch (error) {
      console.error('Reopen pipeline error:', error);
      alert('Failed to reopen pipeline');
    }
  };

  const handleStepComplete = async (stepId: string) => {
    try {
      const res = await fetch(`/api/steps/${stepId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member?.id }),
      });

      if (res.ok) {
        loadDashboard();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to complete step');
      }
    } catch (error) {
      console.error('Complete step error:', error);
      alert('Failed to complete step');
    }
  };

  const handleStepReturn = async (stepId: string) => {
    const reason = prompt('Why are you returning this step?');
    if (!reason) return;

    try {
      const res = await fetch(`/api/steps/${stepId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member?.id, reason }),
      });

      if (res.ok) {
        loadDashboard();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to return step');
      }
    } catch (error) {
      console.error('Return step error:', error);
      alert('Failed to return step');
    }
  };

  const handleStepClaim = async (stepId: string) => {
    try {
      const res = await fetch(`/api/steps/${stepId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member?.id }),
      });

      if (res.ok) {
        loadDashboard();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to claim step');
      }
    } catch (error) {
      console.error('Claim step error:', error);
      alert('Failed to claim step');
    }
  };

  const handleLogout = async () => {
    await signOut();
    clear();
    router.push('/login');
  };

  return (
    <div className="glass-bg min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="header-banner">
        <div className="header-banner-content px-4 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Logo/Icon - Replace default with team logo if uploaded */}
              {team?.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="w-20 h-20 rounded-xl object-cover shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">Task Pulse</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-teal-100 text-sm">{business?.name}</span>
                  <span className="text-teal-300">•</span>
                  <span className="text-white text-sm font-medium">{team?.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* User email */}
              {member && (
                <span className="text-sm text-white/60 hidden sm:block">{member.email}</span>
              )}

              {/* Admin button with gear icon */}
              {member?.role === 'admin' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-2 text-sm bg-white/10 text-white py-2 px-4 rounded-lg hover:bg-white/20 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="hidden sm:inline">Admin</span>
                </button>
              )}

              {/* Notifications button */}
              {member && (
                <button
                  onClick={() => router.push('/notifications')}
                  className="flex items-center gap-2 text-sm bg-white/10 text-white py-2 px-4 rounded-lg hover:bg-white/20 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="hidden sm:inline">Notifications</span>
                </button>
              )}

              {/* Log Entry button - white */}
              <button
                onClick={() => router.push('/add-log')}
                className="flex items-center gap-2 text-sm bg-white text-teal-700 py-2 px-4 rounded-lg hover:bg-white/90 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Log Entry</span>
              </button>

              {/* User dropdown with team switch and logout */}
              <div className="relative group">
                <button className="flex items-center gap-2 text-sm text-white/70 py-2 px-3 rounded-lg hover:bg-white/10 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-visible"
                  style={{ minWidth: '280px' }}
                >
                  {/* Team switcher section */}
                  {availableTeams.length > 1 && (
                    <>
                      <div className="px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Switch Team</div>
                      {availableTeams.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleTeamSwitch(t)}
                          className={`block w-full px-4 py-2 text-left text-sm ${
                            t.id === teamId
                              ? 'text-teal-600 bg-teal-50 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {t.name}
                          {t.id === teamId && ' ✓'}
                        </button>
                      ))}
                      <div className="border-t border-gray-100 my-2" />
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Announcements, Shared Links & Calendar Section */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ minHeight: '16vh' }}>
          {/* Announcements - Left */}
          <div className="glass-card rounded-xl p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                Announcements
              </h2>
              {announcements.length > 3 && (
                <button
                  onClick={() => setShowAllAnnouncements(true)}
                  className="text-[10px] text-teal-600 hover:text-teal-700 font-medium"
                >
                  View All ({announcements.length})
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {announcements.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No announcements yet</p>
              ) : (
                announcements.slice(0, 3).map((announcement) => (
                  <div key={announcement.id} className="bg-slate-50 rounded-md p-2 border-l-2 border-teal-500">
                    <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-2">{announcement.content}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                      <span>{(announcement.member as { name?: string })?.name || 'Unknown'}</span>
                      <span>•</span>
                      <span>{new Date(announcement.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Shared Links - Middle */}
          <div className="glass-card rounded-xl p-3 flex flex-col">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              Shared Links
            </h2>
            <div className="flex-1 overflow-y-auto">
              {sharedLinks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No shared links yet</p>
              ) : (
                <table className="w-full text-xs">
                  <tbody>
                    {sharedLinks.map((link) => (
                      <tr key={link.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 pr-2">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-teal-600 hover:text-teal-700 hover:underline"
                          >
                            {link.title}
                          </a>
                          {link.description && (
                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{link.description}</p>
                          )}
                        </td>
                        <td className="py-1.5 text-right">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-teal-600"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Calendar - Right */}
          <div className="glass-card rounded-xl p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                Calendar
              </h2>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => {
                    const [year, month] = calendarMonth.split('-').map(Number);
                    const prevDate = new Date(year, month - 2, 1);
                    const newMonth = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
                    setCalendarMonth(newMonth);
                    loadCalendarEvents(newMonth);
                  }}
                  className="p-0.5 hover:bg-slate-100 rounded"
                  title="Previous month"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-[10px] font-medium text-slate-600 min-w-[60px] text-center">
                  {new Date(calendarMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <button
                  onClick={() => {
                    const [year, month] = calendarMonth.split('-').map(Number);
                    const nextDate = new Date(year, month, 1);
                    const newMonth = `${nextDate.getFullYear()}-${(nextDate.getMonth() + 1).toString().padStart(2, '0')}`;
                    setCalendarMonth(newMonth);
                    loadCalendarEvents(newMonth);
                  }}
                  className="p-0.5 hover:bg-slate-100 rounded"
                  title="Next month"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const todayMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
                    setCalendarMonth(todayMonth);
                    loadCalendarEvents(todayMonth);
                  }}
                  className="ml-1 px-1.5 py-0.5 text-[10px] text-teal-600 hover:bg-teal-50 rounded font-medium"
                  title="Go to today"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px mb-0.5">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <div key={day} className="text-[10px] text-slate-400 text-center py-0.5">{day}</div>
                ))}
              </div>
              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-px">
                {(() => {
                  const [year, month] = calendarMonth.split('-').map(Number);
                  const firstDay = new Date(year, month - 1, 1).getDay();
                  const daysInMonth = new Date(year, month, 0).getDate();
                  const today = new Date();
                  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

                  const days = [];
                  // Empty cells for days before first of month
                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} className="min-h-[40px]" />);
                  }
                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${calendarMonth}-${day.toString().padStart(2, '0')}`;
                    const dayEvents = calendarItems.filter(e => e.event_date === dateStr);
                    const isToday = isCurrentMonth && today.getDate() === day;
                    const isSelected = selectedDate === dateStr;

                    days.push(
                      <button
                        key={day}
                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                        className={`min-h-[40px] text-xs rounded flex flex-col items-center pt-0.5 transition-colors overflow-hidden ${
                          isToday ? 'bg-teal-100 font-semibold text-teal-700' :
                          isSelected ? 'bg-slate-200' :
                          'hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[9px]">{day}</span>
                        {dayEvents.length > 0 && (() => {
                          const manualEvents = dayEvents.filter(e => e.source === 'manual');
                          const autoEvents = dayEvents.filter(e => e.source !== 'manual');
                          return (
                            <div className="w-full px-0.5 mt-0.5 space-y-0.5 overflow-hidden">
                              {/* Manual events show with title */}
                              {manualEvents.slice(0, 2).map((event, idx) => (
                                <div
                                  key={idx}
                                  className="text-[8px] leading-tight truncate px-0.5 rounded"
                                  style={{ backgroundColor: event.color, color: 'white' }}
                                  title={event.title}
                                >
                                  {event.title}
                                </div>
                              ))}
                              {/* Auto deadlines show as colored dots */}
                              {autoEvents.length > 0 && (
                                <div className="flex gap-0.5 justify-center mt-0.5">
                                  {autoEvents.slice(0, 4).map((event, idx) => (
                                    <div
                                      key={`auto-${idx}`}
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: event.color }}
                                      title={event.title}
                                    />
                                  ))}
                                  {autoEvents.length > 4 && (
                                    <span className="text-[7px] text-slate-400">+{autoEvents.length - 4}</span>
                                  )}
                                </div>
                              )}
                              {manualEvents.length > 2 && (
                                <div className="text-[8px] text-slate-400 text-center">
                                  +{manualEvents.length - 2}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </button>
                    );
                  }
                  return days;
                })()}
              </div>
            </div>

            {/* Selected date events */}
            {selectedDate && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-600 mb-1">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {calendarItems.filter(e => e.event_date === selectedDate).length === 0 ? (
                    <p className="text-xs text-slate-400">No events</p>
                  ) : (
                    calendarItems.filter(e => e.event_date === selectedDate).map((event) => (
                      <div key={event.id} className="flex items-center gap-1.5 text-xs group">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: event.color }} />
                        <span className="text-slate-700 truncate flex-1">{event.title}</span>
                        {event.source !== 'manual' && (
                          <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100">
                            {event.source === 'task' ? 'deadline' : 'due'}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Announcements Modal */}
      {showAllAnnouncements && (
        <div className="modal-overlay" onClick={() => setShowAllAnnouncements(false)}>
          <div className="modal-content p-6 max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">All Announcements</h2>
              <button
                onClick={() => setShowAllAnnouncements(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="bg-slate-50 rounded-lg p-4 border-l-3 border-teal-500">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{announcement.content}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    <span>{(announcement.member as { name?: string })?.name || 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(announcement.created_at).toLocaleDateString()} {new Date(announcement.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {announcement.updated_at !== announcement.created_at && (
                      <span className="text-slate-300">(edited)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filter tabs */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'active'
                ? 'bg-teal-100 text-teal-800'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Active Pipelines
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed'
                ? 'bg-teal-100 text-teal-800'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Completed Pipelines
          </button>

          <div className="flex-1" />
        </div>

        {/* Dashboard Summary - only show for active tasks */}
        {!loading && filter === 'active' && (
          <DashboardSummary tasks={tasks} members={members} />
        )}

        {/* Pipeline Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : (
          <PipelineGrid
            tasks={tasks}
            members={members}
            onStepClick={handleStepClick}
            onStepComplete={handleStepComplete}
            onStepReturn={handleStepReturn}
            onStepClaim={handleStepClaim}
            onTaskEdit={handleTaskEdit}
            onTaskDelete={handleTaskDelete}
            onTaskReopen={handleTaskReopen}
            currentMemberId={member?.id}
            isAdmin={member?.role === 'admin'}
            isCompletedView={filter === 'completed'}
          />
        )}
      </main>

      {/* Step Detail Modal */}
      <StepDetailModal
        stepId={selectedStepId || ''}
        taskId={selectedTaskId || ''}
        isOpen={!!selectedStepId}
        onClose={() => {
          setSelectedStepId(null);
          setSelectedTaskId(null);
        }}
        currentMemberId={member?.id}
        onStepCompleted={loadDashboard}
      />

      {/* Task Edit Modal */}
      <TaskEditModal
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        teamId={teamId || ''}
        onTaskUpdated={loadDashboard}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
