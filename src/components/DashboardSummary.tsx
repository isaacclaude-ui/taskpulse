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
      {/* 1. Pipeline Progress Cards - with NOW waiting on info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pipelineProgress.map(pipeline => (
          <div
            key={pipeline.id}
            className="bg-white rounded-lg border border-gray-200 p-3"
          >
            {/* Title + percentage */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate flex-1" title={pipeline.title}>
                {pipeline.title}
              </h3>
              <span className="text-xs ml-2">
                <span className="font-bold text-teal-600">{pipeline.percent}%</span>
                <span className="text-gray-400 ml-1">({pipeline.completed}/{pipeline.total})</span>
              </span>
            </div>

            {/* Segmented progress bar */}
            <div className="flex items-center gap-0.5 mb-2">
              {Array.from({ length: pipeline.total }).map((_, i) => {
                const isCompleted = i < pipeline.completed;
                const isCurrent = i === pipeline.completed;
                return (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-500'
                        : isCurrent
                        ? 'bg-amber-400'
                        : 'bg-gray-200'
                    }`}
                  />
                );
              })}
            </div>

            {/* Current step info - NOW waiting on format */}
            <div className="text-xs">
              {pipeline.currentStep ? (
                <span className="inline-flex items-center gap-1">
                  <span className="text-amber-600 font-medium">NOW</span>
                  <span className="text-gray-400">—</span>
                  {pipeline.currentAssignee && (
                    <span className="text-amber-700 font-semibold">{getFirstName(pipeline.currentAssignee)}</span>
                  )}
                  {pipeline.currentAssignee && <span className="text-gray-400"> → </span>}
                  <span className="text-gray-600">{pipeline.currentStep}</span>
                </span>
              ) : (
                <span className="text-emerald-600">All steps complete</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Team Member Cards - Individual stats */}
      {memberStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {memberStats.map(stat => {
            const isUrgent = stat.now > 0;
            return (
              <div
                key={stat.id}
                className={`rounded-lg p-2.5 ${
                  isUrgent
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="font-medium text-gray-900 text-sm truncate mb-1.5" title={stat.name}>
                  {getFirstName(stat.name)}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1" title="Done">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-emerald-700">{stat.done}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Now">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className={`font-semibold ${isUrgent ? 'text-amber-700' : 'text-gray-400'}`}>{stat.now}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Coming Soon">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span className="font-semibold text-blue-600">{stat.comingSoon}</span>
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
