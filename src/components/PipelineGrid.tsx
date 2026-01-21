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
  onTaskUpdate?: (taskId: string, updates: { title?: string; deadline?: string | null }) => void;
  onStepUpdate?: (stepId: string, updates: { name?: string; mini_deadline?: string | null }) => void;
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
  onTaskUpdate,
  onStepUpdate,
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
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-6 text-xs text-gray-600">
        <span className="font-medium text-gray-500">Status:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
          <span>Now</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
          <span>Coming Soon</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
          <span>Done</span>
        </div>
      </div>
      {/* Scrollable container with max height */}
      <div className="overflow-auto max-h-[calc(100vh-260px)] bg-gray-50">
        <table className="border-collapse w-full" style={{ minWidth: `${tableWidth}px` }}>
          {/* Frozen header row */}
          <thead>
            <tr className="bg-gray-50">
              {/* Pipeline header - frozen corner */}
              <th
                className="sticky top-0 left-0 z-30 bg-gray-50 border-b border-r border-gray-200 p-3 text-left font-medium text-gray-700 text-sm"
                style={{ width: `${TASK_COL_WIDTH}px`, minWidth: `${TASK_COL_WIDTH}px`, maxWidth: `${TASK_COL_WIDTH}px` }}
              >
                Pipeline
              </th>
              {/* Member headers - frozen row, equal fixed widths */}
              {displayMembers.map((member) => (
                <th
                  key={member.id}
                  className="sticky top-0 z-20 bg-gray-50 border-b border-l border-gray-200 p-3 font-medium text-gray-700 text-sm text-center"
                  style={{ width: `${MEMBER_COL_WIDTH}px`, minWidth: `${MEMBER_COL_WIDTH}px`, maxWidth: `${MEMBER_COL_WIDTH}px` }}
                >
                  <div className="truncate" title={member.name}>{member.name}</div>
                  {member.email && (
                    <div className="text-xs text-gray-400 font-normal truncate">{member.email}</div>
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
                onTaskUpdate={onTaskUpdate}
                onStepUpdate={onStepUpdate}
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
