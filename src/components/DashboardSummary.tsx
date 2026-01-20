'use client';

import { TaskWithSteps, Member } from '@/types';

interface DashboardSummaryProps {
  tasks: TaskWithSteps[];
  members: Member[];
}

interface MemberStats {
  id: string;
  name: string;
  done: number;
  now: number;
  comingSoon: number;
  total: number;
}

export default function DashboardSummary({ tasks, members }: DashboardSummaryProps) {
  // Calculate stats for each member
  const memberStats: MemberStats[] = members.map(member => {
    let done = 0;
    let now = 0;
    let comingSoon = 0;

    tasks.forEach(task => {
      task.pipeline_steps.forEach(step => {
        const isAssigned = step.assigned_to === member.id ||
          (step.additional_assignees && step.additional_assignees.includes(member.id));

        if (isAssigned) {
          if (step.status === 'completed') {
            done++;
          } else if (step.status === 'unlocked') {
            now++;
          } else if (step.status === 'locked') {
            comingSoon++;
          }
        }
      });
    });

    return {
      id: member.id,
      name: member.name,
      done,
      now,
      comingSoon,
      total: done + now + comingSoon,
    };
  }).filter(m => m.total > 0);

  memberStats.sort((a, b) => b.now - a.now || b.total - a.total);

  if (tasks.length === 0) return null;

  const getFirstName = (name: string) => name.split(' ')[0];

  // Calculate pipeline progress for each task
  const pipelineProgress = tasks.map(task => {
    const completed = task.pipeline_steps.filter(s => s.status === 'completed').length;
    const total = task.pipeline_steps.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const currentStep = task.pipeline_steps.find(s => s.status === 'unlocked');
    return {
      id: task.id,
      title: task.title,
      completed,
      total,
      percent,
      currentStep: currentStep?.name || null,
      currentAssignee: currentStep?.member?.name || null,
    };
  });

  return (
    <div className="mb-6 space-y-4">
      {/* 1. Pipeline Progress Cards - Premium Design */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-800 p-5 shadow-xl">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Header */}
        <div className="relative flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            {/* Pipeline count - prominent */}
            <div className="bg-white/15 backdrop-blur-sm px-5 py-2 rounded-xl border border-white/20">
              <span className="text-3xl font-bold text-white">{tasks.length}</span>
              <span className="text-sm text-teal-100 ml-2">pipeline{tasks.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
              <span className="text-base font-semibold text-white uppercase tracking-wide">Active</span>
              <span className="text-sm text-teal-200">— waiting on</span>
            </div>
          </div>
        </div>

        {/* Pipeline Cards */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelineProgress.map(pipeline => (
            <div
              key={pipeline.id}
              className="group bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
            >
              {/* Title + percentage */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-bold text-slate-800 leading-tight pr-2" title={pipeline.title}>
                  {pipeline.title}
                </h3>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-2xl font-bold text-teal-600">{pipeline.percent}%</span>
                  <span className="text-xs text-slate-400">({pipeline.completed}/{pipeline.total})</span>
                </div>
              </div>

              {/* Segmented progress bar */}
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: pipeline.total }).map((_, i) => {
                  const isCompleted = i < pipeline.completed;
                  const isCurrent = i === pipeline.completed;
                  return (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full transition-all ${
                        isCompleted
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-sm'
                          : isCurrent
                          ? 'bg-gradient-to-r from-amber-400 to-orange-400 shadow-sm animate-pulse'
                          : 'bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Current step info */}
              <div className="flex items-center gap-2 text-sm bg-teal-50 rounded-lg px-3 py-2">
                {pipeline.currentStep ? (
                  <>
                    {pipeline.currentAssignee && (
                      <span className="font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                        {getFirstName(pipeline.currentAssignee)}
                      </span>
                    )}
                    <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-teal-700 truncate">{pipeline.currentStep}</span>
                  </>
                ) : (
                  <span className="text-emerald-600 font-medium">All steps complete</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Team Member Cards - with explicit labels */}
      {memberStats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {memberStats.map(stat => {
            const isUrgent = stat.now > 0;
            return (
              <div
                key={stat.id}
                className={`rounded-lg p-2.5 w-[calc(50%-4px)] sm:w-[calc(33.333%-6px)] md:w-[calc(25%-6px)] lg:w-[140px] transition-all ${
                  isUrgent
                    ? 'bg-orange-100 border-2 border-orange-400 shadow-sm'
                    : 'bg-white border border-slate-200'
                }`}
              >
                <div className="font-medium text-slate-800 text-sm truncate mb-1.5" title={stat.name}>
                  {getFirstName(stat.name)}
                </div>
                <div className="flex flex-col gap-0.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Now</span>
                    <span className={`font-semibold ${isUrgent ? 'text-orange-600' : 'text-slate-400'}`}>{stat.now}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Next</span>
                    <span className="font-semibold text-blue-600">{stat.comingSoon}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Done</span>
                    <span className="font-semibold text-emerald-600">{stat.done}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
