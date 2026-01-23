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
  // Calculate stats for each member (only active members with valid non-empty names)
  const memberStats: MemberStats[] = members
    .filter(member => member.name && member.name.trim() && !member.is_archived) // Exclude archived and nameless members
    .map(member => {
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
    })
    .filter(m => m.total > 0 && m.name); // Double-check: must have assignments AND valid name

  memberStats.sort((a, b) => b.now - a.now || b.total - a.total);

  if (tasks.length === 0) return null;

  // Smart name display: use first name unless there are duplicates
  const getDisplayName = (name: string, allNames: string[]) => {
    if (!name) return 'Unknown';
    const firstName = name.split(' ')[0];
    // Check if any other name has the same first name
    const duplicateFirstNames = allNames.filter(n => n && n.split(' ')[0] === firstName);
    if (duplicateFirstNames.length > 1) {
      // Multiple people with same first name - show more of the name
      const parts = name.split(' ');
      if (parts.length > 1) {
        // Show first name + initial of last name (e.g., "Isaac T")
        return `${parts[0]} ${parts[parts.length - 1][0]}`;
      }
    }
    return firstName;
  };

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

  // Collect all names for smart display (from stats + pipeline assignees)
  const allMemberNames = [
    ...memberStats.map(m => m.name),
    ...pipelineProgress.map(p => p.currentAssignee).filter(Boolean) as string[]
  ];
  const getFirstName = (name: string) => getDisplayName(name, allMemberNames);

  return (
    <div className="mb-4 space-y-3 overflow-x-hidden">
      {/* 1. Pipeline Progress Cards - Compact Design */}
      <div className="relative rounded-xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-800 p-3 shadow-lg">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        {/* Header */}
        <div className="relative flex flex-wrap items-center gap-2 mb-3">
          {/* Pipeline count - compact */}
          <div className="bg-white/15 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/20">
            <span className="text-xl font-bold text-white">{tasks.length}</span>
            <span className="text-xs text-teal-100 ml-1">pipeline{tasks.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-white uppercase tracking-wide">Active</span>
            <span className="text-xs text-teal-200 hidden sm:inline">— waiting on</span>
          </div>
        </div>

        {/* Pipeline Cards */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {pipelineProgress.map(pipeline => (
            <div
              key={pipeline.id}
              className="group bg-white rounded-lg p-3 shadow-md hover:shadow-lg transition-all duration-200"
            >
              {/* Title + percentage */}
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-800 leading-tight pr-2 line-clamp-1" title={pipeline.title}>
                  {pipeline.title}
                </h3>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-lg font-bold text-teal-600">{pipeline.percent}%</span>
                  <span className="text-[10px] text-slate-400">({pipeline.completed}/{pipeline.total})</span>
                </div>
              </div>

              {/* Segmented progress bar with arrow */}
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: pipeline.total }).map((_, i) => {
                  const isCompleted = i < pipeline.completed;
                  const isCurrent = i === pipeline.completed;
                  const isLast = i === pipeline.total - 1;
                  return (
                    <div key={i} className="flex-1 flex items-center">
                      <div
                        className={`h-2.5 flex-1 ${isLast ? 'rounded-l-full' : 'rounded-full'} transition-all ${
                          isCompleted
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : isCurrent
                            ? 'bg-gradient-to-r from-green-400 to-green-500 animate-pulse'
                            : 'bg-slate-200'
                        }`}
                      />
                      {/* Arrow tip on last segment - glowing arrowhead */}
                      {isLast && (
                        <svg
                          className={`w-5 h-5 -ml-0.5 flex-shrink-0 transition-all ${
                            isCompleted
                              ? 'text-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]'
                              : isCurrent
                              ? 'text-green-500 drop-shadow-[0_0_6px_rgba(34,197,94,0.7)]'
                              : 'text-slate-300'
                          }`}
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M4 4L18 12L4 20V4Z"/>
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Current step info */}
              <div className="flex items-center gap-1.5 text-xs bg-teal-50 rounded-md px-2 py-1.5">
                {pipeline.currentStep ? (
                  <>
                    {pipeline.currentAssignee && (
                      <span className="font-semibold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded text-[11px]">
                        {getFirstName(pipeline.currentAssignee)}
                      </span>
                    )}
                    <svg className="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-teal-700 truncate text-[11px]">{pipeline.currentStep}</span>
                  </>
                ) : (
                  <span className="text-emerald-600 font-medium text-[11px]">All steps complete</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Team Member Cards - horizontally scrollable on small screens */}
      {memberStats.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {memberStats.map(stat => {
            const isUrgent = stat.now > 0;
            return (
              <div
                key={stat.id}
                className={`rounded-md p-2 min-w-[100px] flex-shrink-0 transition-all ${
                  isUrgent
                    ? 'bg-green-100 border-2 border-green-400'
                    : 'bg-white border border-slate-200'
                }`}
              >
                <div className="font-medium text-slate-800 text-xs truncate mb-1" title={stat.name}>
                  {getFirstName(stat.name)}
                </div>
                <div className="flex flex-col gap-0 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Now</span>
                    <span className={`font-semibold ${isUrgent ? 'text-green-600' : 'text-slate-400'}`}>{stat.now}</span>
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
