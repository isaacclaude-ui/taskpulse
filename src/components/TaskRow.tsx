'use client';

import { useState } from 'react';
import { TaskWithSteps, Member, PipelineStepWithMember, TaskRecurrence } from '@/types';
import PersonCell from './PersonCell';

// Helper to format recurrence for short display
function formatRecurrenceShort(rec: TaskRecurrence | undefined): string {
  if (!rec || !rec.enabled) return '';
  const { type, interval } = rec;
  if (interval === 1) {
    if (type === 'daily') return 'Daily';
    if (type === 'weekly') return 'Weekly';
    if (type === 'monthly') return 'Monthly';
  }
  if (type === 'daily') return `Every ${interval}d`;
  if (type === 'weekly') return `Every ${interval}w`;
  if (type === 'monthly') return `Every ${interval}mo`;
  return '';
}

interface TaskRowProps {
  task: TaskWithSteps;
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

export default function TaskRow({
  task,
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
}: TaskRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [deadlineValue, setDeadlineValue] = useState(task.deadline || '');
  const hasDeadline = task.deadline && new Date(task.deadline) < new Date();

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== task.title && onTaskUpdate) {
      onTaskUpdate(task.id, { title: titleValue.trim() });
    }
    setEditingTitle(false);
  };

  const handleDeadlineSave = () => {
    if (onTaskUpdate) {
      onTaskUpdate(task.id, { deadline: deadlineValue || null });
    }
    setEditingDeadline(false);
  };

  // Group steps by assigned person (including joint assignments)
  const stepsByPerson = new Map<string, PipelineStepWithMember[]>();
  task.pipeline_steps.forEach(step => {
    // Primary assignee
    const personId = step.assigned_to || 'unassigned';
    if (!stepsByPerson.has(personId)) {
      stepsByPerson.set(personId, []);
    }
    stepsByPerson.get(personId)!.push(step);

    // Additional assignees (for joint steps) - add mirrored reference
    if (step.is_joint && step.additional_assignees && step.additional_assignees.length > 0) {
      step.additional_assignees.forEach((additionalId: string) => {
        if (additionalId !== step.assigned_to) { // Don't double-add primary
          if (!stepsByPerson.has(additionalId)) {
            stepsByPerson.set(additionalId, []);
          }
          // Mark this as a mirror (same step object, will be displayed in multiple columns)
          stepsByPerson.get(additionalId)!.push(step);
        }
      });
    }
  });

  // Calculate task progress
  const completedSteps = task.pipeline_steps.filter(s => s.status === 'completed').length;
  const totalSteps = task.pipeline_steps.length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Fixed column widths (must match PipelineGrid)
  const TASK_COL_WIDTH = 240;
  const MEMBER_COL_WIDTH = 180;

  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      {/* Task info cell - frozen first column */}
      <td
        className="sticky left-0 z-10 bg-white border-r border-gray-100 p-3"
        style={{ width: `${TASK_COL_WIDTH}px`, minWidth: `${TASK_COL_WIDTH}px`, maxWidth: `${TASK_COL_WIDTH}px` }}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {/* Editable Title */}
            {editingTitle ? (
              <div className="flex items-center gap-1 -m-1">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') { setTitleValue(task.title); setEditingTitle(false); }
                  }}
                  className="flex-1 text-xs font-medium px-1.5 py-1 border border-teal-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                  autoFocus
                />
              </div>
            ) : (
              <div
                className="flex items-start gap-1 cursor-pointer hover:bg-teal-50 -m-1 p-1 rounded transition-colors group"
                onClick={() => { setTitleValue(task.title); setEditingTitle(true); }}
                title="Click to edit title"
              >
                <span className="font-medium text-gray-900 text-xs leading-tight line-clamp-2">
                  {task.title}
                </span>
                {task.recurrence?.enabled && (
                  <span className="flex items-center gap-0.5 text-teal-600 shrink-0" title={formatRecurrenceShort(task.recurrence)}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {task.recurrence_count && task.recurrence_count > 0 && (
                      <span className="text-[9px] font-normal">#{task.recurrence_count + 1}</span>
                    )}
                  </span>
                )}
                <svg className="w-3 h-3 text-gray-300 group-hover:text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            )}
            {/* Editable Deadline */}
            {editingDeadline ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="date"
                  value={deadlineValue}
                  onChange={(e) => setDeadlineValue(e.target.value)}
                  onBlur={handleDeadlineSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDeadlineSave();
                    if (e.key === 'Escape') { setDeadlineValue(task.deadline || ''); setEditingDeadline(false); }
                  }}
                  className="text-xs px-1.5 py-0.5 border border-teal-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                  autoFocus
                />
                <button
                  onClick={() => { setDeadlineValue(''); handleDeadlineSave(); }}
                  className="text-gray-400 hover:text-red-500 p-0.5"
                  title="Clear deadline"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                className="text-xs mt-1 cursor-pointer hover:bg-teal-50 inline-flex items-center gap-1 px-1 -mx-1 rounded transition-colors group"
                onClick={() => { setDeadlineValue(task.deadline || ''); setEditingDeadline(true); }}
                title="Click to edit deadline"
              >
                {task.deadline ? (
                  <span className={hasDeadline ? 'text-red-600' : 'text-gray-500'}>
                    Due: {new Date(task.deadline).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-gray-400">+ Add deadline</span>
                )}
                <svg className="w-3 h-3 text-gray-300 group-hover:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {/* AI-generated workflow summary - clickable to open AI editor */}
            <div
              className="mt-1 cursor-pointer hover:bg-teal-50 -mx-1 px-1 rounded transition-colors group/desc"
              onClick={() => onTaskEdit(task.id)}
              title="Click to edit with AI"
            >
              {task.description ? (
                <p className="text-[10px] text-gray-400 line-clamp-2 group-hover/desc:text-teal-600">
                  {task.description}
                </p>
              ) : (
                <p className="text-[10px] text-gray-400 group-hover/desc:text-teal-600">
                  + Edit with AI
                </p>
              )}
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {/* Reopen button - only for completed pipelines */}
            {isCompletedView && onTaskReopen && (
              <button
                onClick={() => onTaskReopen(task.id)}
                className="px-2 py-1 text-xs font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors flex items-center gap-1"
                title="Reopen pipeline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reopen
              </button>
            )}
            {/* Delete button */}
            {/* Duplicate button */}
            {onTaskDuplicate && !isCompletedView && (
              <button
                onClick={() => onTaskDuplicate(task.id)}
                className="p-1 text-gray-300 hover:text-teal-500 hover:bg-teal-50 rounded transition-colors"
                title="Duplicate pipeline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            {/* Delete button */}
            {showDeleteConfirm ? (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-gray-500">Delete?</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      onTaskDelete(task.id);
                      setShowDeleteConfirm(false);
                    }}
                    className="px-1.5 py-0.5 text-red-600 hover:bg-red-100 rounded text-[10px]"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-1.5 py-0.5 text-gray-600 hover:bg-gray-100 rounded text-[10px]"
                  >
                    No
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Delete pipeline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{completedSteps}/{totalSteps}</span>
          </div>
        </div>
      </td>

      {/* Person cells - what steps each person has */}
      {members.map((member) => {
        const personSteps = stepsByPerson.get(member.id) || [];
        return (
          <td key={member.id} className="p-0 bg-white" style={{ width: `${MEMBER_COL_WIDTH}px`, minWidth: `${MEMBER_COL_WIDTH}px`, maxWidth: `${MEMBER_COL_WIDTH}px` }}>
            <PersonCell
              steps={personSteps}
              allSteps={task.pipeline_steps}
              member={member}
              taskId={task.id}
              onStepClick={onStepClick}
              onStepComplete={onStepComplete}
              onStepReturn={onStepReturn}
              onStepClaim={onStepClaim}
              isCurrentUser={currentMemberId === member.id}
              isAdmin={isAdmin}
            />
          </td>
        );
      })}

    </tr>
  );
}
