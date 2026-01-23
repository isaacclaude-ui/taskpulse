'use client';

import { TaskWithSteps, Member } from '@/types';
import TaskRow from './TaskRow';

interface PipelineGridProps {
  tasks: TaskWithSteps[];
  members: Member[];
  onStepClick: (stepId: string, taskId: string) => void;
  onStepComplete: (stepId: string) => void;
  onStepReturn: (stepId: string) => void;
  onStepClaim?: (stepId: string) => void;
  onTaskEdit: (taskId: string) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskDuplicate?: (taskId: string) => void;
  onTaskReopen?: (taskId: string) => void;
  currentMemberId?: string;
  isAdmin?: boolean;
  isCompletedView?: boolean;
}

export default function PipelineGrid({
  tasks,
  members,
  onStepClick,
  onStepComplete,
  onStepReturn,
  onStepClaim,
  onTaskEdit,
  onTaskDelete,
  onTaskDuplicate,
  onTaskReopen,
  currentMemberId,
  isAdmin = false,
  isCompletedView = false
}: PipelineGridProps) {
  if (tasks.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No pipelines yet</h3>
        <p className="text-gray-500">Click &quot;Add Log&quot; to create your first pipeline</p>
      </div>
    );
  }

  // Get unique people from all tasks' steps (including joint assignments)
  const peopleInTasks = new Set<string>();
  tasks.forEach(task => {
    task.pipeline_steps.forEach(step => {
      if (step.assigned_to) {
        peopleInTasks.add(step.assigned_to);
      }
      // Also include additional assignees for joint tasks
      if (step.additional_assignees && step.additional_assignees.length > 0) {
        step.additional_assignees.forEach((id: string) => peopleInTasks.add(id));
      }
    });
  });

  // Filter members: only active (non-archived) members with valid non-empty names who are assigned to tasks
  const activeMembers = members.filter(m => m.name && m.name.trim() && !m.is_archived);
  const relevantMembers = activeMembers.filter(m => peopleInTasks.has(m.id));
  const displayMembers = relevantMembers.length > 0 ? relevantMembers : activeMembers.slice(0, 5);

  // Fixed column widths
  const TASK_COL_WIDTH = 240;
  const MEMBER_COL_WIDTH = 180;
  const tableWidth = TASK_COL_WIDTH + displayMembers.length * MEMBER_COL_WIDTH;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Legend */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-teal-50/30 border-b border-gray-200 flex items-center gap-5 text-xs">
        <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Status</span>
        <div className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-full">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-sm"></span>
          <span className="text-slate-600 font-medium">Now</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-full">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 shadow-sm"></span>
          <span className="text-slate-600 font-medium">Coming Soon</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-full">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 shadow-sm"></span>
          <span className="text-slate-600 font-medium">Done</span>
        </div>
      </div>
      {/* Scrollable container with max height */}
      <div className="overflow-auto max-h-[calc(100vh-260px)] bg-gray-50">
        <table className="border-collapse w-full" style={{ minWidth: `${tableWidth}px` }}>
          {/* Frozen header row */}
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-gray-50">
              {/* Pipeline header - frozen corner */}
              <th
                className="sticky top-0 left-0 z-30 bg-gradient-to-r from-teal-600 to-teal-700 border-b border-r border-teal-700 p-3 text-left font-semibold text-white text-sm shadow-sm"
                style={{ width: `${TASK_COL_WIDTH}px`, minWidth: `${TASK_COL_WIDTH}px`, maxWidth: `${TASK_COL_WIDTH}px` }}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Pipeline
                </div>
              </th>
              {/* Member headers - frozen row, equal fixed widths */}
              {displayMembers.map((member) => (
                <th
                  key={member.id}
                  className="sticky top-0 z-20 bg-slate-200 border-b border-l border-slate-300 p-3 font-semibold text-slate-700 text-sm text-center"
                  style={{ width: `${MEMBER_COL_WIDTH}px`, minWidth: `${MEMBER_COL_WIDTH}px`, maxWidth: `${MEMBER_COL_WIDTH}px` }}
                >
                  <div className="truncate" title={member.name}>{member.name}</div>
                  {member.email && (
                    <div className="text-[10px] text-slate-400 font-normal truncate">{member.email}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Task rows */}
          <tbody className="divide-y divide-gray-100">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                members={displayMembers}
                onStepClick={onStepClick}
                onStepComplete={onStepComplete}
                onStepReturn={onStepReturn}
                onStepClaim={onStepClaim}
                onTaskEdit={onTaskEdit}
                onTaskDelete={onTaskDelete}
                onTaskDuplicate={onTaskDuplicate}
                onTaskReopen={onTaskReopen}
                currentMemberId={currentMemberId}
                isAdmin={isAdmin}
                isCompletedView={isCompletedView}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
