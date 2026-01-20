'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, signOut } from '@/lib/auth';
import { useNav } from '@/context/NavContext';
import PipelineGrid from '@/components/PipelineGrid';
import StepDetailModal from '@/components/StepDetailModal';
import TaskEditModal from '@/components/TaskEditModal';
import NotificationBell from '@/components/NotificationBell';
import DashboardSummary from '@/components/DashboardSummary';
import type { TaskWithSteps, Member, Team } from '@/types';

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

  const handleTeamSwitch = (newTeam: Team) => {
    setTeamId(newTeam.id);
    setTeam(newTeam);
  };

  useEffect(() => {
    if (teamId && member) {
      loadDashboard();
    }
  }, [filter, teamId]);

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
    <div className="glass-bg min-h-screen">
      {/* Header */}
      <header className="header-banner">
        <div className="header-banner-content px-4 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Task Pulse</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-teal-100 text-sm">{business?.name}</span>
                <span className="text-teal-300">•</span>
                <span className="text-white text-sm font-medium">{team?.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notification bell */}
              {member && <NotificationBell memberId={member.id} />}

              <button
                onClick={() => router.push('/add-log')}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Log
              </button>

              {member?.role === 'admin' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  Admin
                </button>
              )}

              <div className="relative group">
                <button className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
                  <span>{member?.name}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {/* Team switcher section */}
                  {availableTeams.length > 1 && (
                    <>
                      <div className="px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Teams</div>
                      {availableTeams.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleTeamSwitch(t)}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                            t.id === teamId
                              ? 'text-teal-600 bg-teal-50 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate">{t.name}</span>
                          {t.id === teamId && (
                            <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                      <div className="border-t border-gray-100 my-2" />
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 whitespace-nowrap"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

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

          <span className="text-sm text-gray-500">
            {tasks.length} pipeline{tasks.length !== 1 ? 's' : ''}
          </span>
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
    </div>
  );
}
