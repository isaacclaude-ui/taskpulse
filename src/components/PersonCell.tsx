'use client';

import { PipelineStepWithMember, Member } from '@/types';

interface PersonCellProps {
  steps: PipelineStepWithMember[];
  allSteps: PipelineStepWithMember[]; // All steps in the task for before/after
  member: Member;
  taskId: string;
  onStepClick: (stepId: string, taskId: string) => void;
  onStepComplete: (stepId: string) => void;
  onStepReturn: (stepId: string) => void;
  onStepClaim?: (stepId: string) => void; // For joint tasks
  isCurrentUser: boolean;
  isAdmin: boolean;
}

export default function PersonCell({
  steps,
  allSteps,
  member,
  taskId,
  onStepClick,
  onStepComplete,
  onStepReturn,
  onStepClaim,
  isCurrentUser,
  isAdmin
}: PersonCellProps) {
  // Helper to get before/after step info
  const getStepContext = (step: PipelineStepWithMember) => {
    const sortedAll = [...allSteps].sort((a, b) => a.step_order - b.step_order);
    const stepIndex = sortedAll.findIndex(s => s.id === step.id);
    const prevStep = stepIndex > 0 ? sortedAll[stepIndex - 1] : null;
    const nextStep = stepIndex < sortedAll.length - 1 ? sortedAll[stepIndex + 1] : null;
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === sortedAll.length - 1;
    return { prevStep, nextStep, isFirst, isLast };
  };

  // Helper to get person name from step
  const getPersonName = (step: PipelineStepWithMember | null | undefined): string => {
    if (!step) return 'Unknown';
    return step.assigned_to_name || step.member?.name || 'Unassigned';
  };
  // No steps assigned to this person for this task
  if (steps.length === 0) {
    return (
      <div className="bg-gray-50/50 min-h-[100px] p-2 flex items-center justify-center border-l border-gray-100">
        <span className="text-gray-300 text-lg">·</span>
      </div>
    );
  }

  // Sort steps by order
  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);

  // Find current (unlocked) step, completed steps, and pending steps
  const completedSteps = sortedSteps.filter(s => s.status === 'completed');
  const currentStep = sortedSteps.find(s => s.status === 'unlocked');
  const pendingSteps = sortedSteps.filter(s => s.status === 'locked');

  // Determine cell status for styling
  const hasActiveStep = !!currentStep;
  const allCompleted = completedSteps.length === steps.length;
  const allPending = pendingSteps.length === steps.length;

  // Non-active cells (completed or all pending) fade into background
  // Color scheme: Done=grey, Now=green
  const cellClass = allCompleted
    ? 'bg-gray-100 border-l-4 border-gray-400 opacity-60'
    : hasActiveStep
    ? 'bg-green-50 border-l-4 border-green-400'
    : allPending
    ? 'bg-white opacity-50'
    : 'bg-white';

  // Render a step card (used for all states)
  const renderStepCard = (step: PipelineStepWithMember, status: 'completed' | 'active' | 'pending') => {
    const { prevStep, nextStep, isFirst, isLast } = getStepContext(step);

    // Color scheme: Done=grey, Now=green, Coming Soon=blue
    const cardStyles = {
      completed: 'bg-gray-100 border border-gray-300',
      active: 'bg-green-50 border border-green-400',
      pending: 'bg-blue-50/50 border border-blue-200 opacity-70',
    };

    const statusIcon = {
      completed: (
        <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ),
      active: <span className="text-green-500">●</span>,
      pending: (
        <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      ),
    };

    return (
      <div
        key={step.id}
        className={`rounded p-2 relative overflow-hidden ${cardStyles[status]} ${status !== 'pending' ? 'cursor-pointer' : ''}`}
        onClick={status !== 'pending' ? () => onStepClick(step.id, taskId) : undefined}
      >
        {/* DONE watermark for completed steps */}
        {status === 'completed' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-300 text-2xl font-bold tracking-widest rotate-[-15deg] pointer-events-none select-none opacity-70">
            DONE
          </div>
        )}

        {/* Before indicator */}
        <div className="text-[9px] text-gray-400 mb-1 relative">
          {isFirst ? (
            <span className={status === 'completed' ? 'text-gray-500' : status === 'active' ? 'text-green-500' : 'text-blue-400'}>● First Step</span>
          ) : (
            <span>← From: {getPersonName(prevStep)}</span>
          )}
        </div>

        {/* Step name with status icon */}
        <div className="flex items-center gap-1 relative">
          {statusIcon[status]}
          <span
            className={`text-xs font-medium truncate ${
              status === 'completed' ? 'text-gray-600' :
              status === 'active' ? 'text-gray-900' :
              'text-blue-700'
            }`}
            title={step.name}
          >
            {step.step_order}. {step.name}
          </span>
        </div>

        {/* Deadline */}
        {step.mini_deadline && (
          <div className={`text-[10px] mt-0.5 ml-4 relative ${
            status === 'active' ? 'text-green-600 font-medium' : 'text-gray-500'
          }`}>
            Due: {new Date(step.mini_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}

        {/* After indicator */}
        <div className="text-[9px] text-gray-400 mt-1 relative">
          {isLast ? (
            <span className={status === 'completed' ? 'text-gray-500' : 'text-green-500'}>● Final Step</span>
          ) : (
            <span>→ To: {getPersonName(nextStep)}</span>
          )}
        </div>

        {/* Joint task indicator */}
        {step.is_joint && (
          <div className="text-[9px] text-purple-600 bg-purple-50 rounded px-1.5 py-0.5 mt-1 relative flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Shared: {step.additional_assignee_names?.join(' or ')}</span>
          </div>
        )}

        {/* Action buttons - only for active step and current user or admin */}
        {status === 'active' && (isCurrentUser || isAdmin) && (
          <div className="flex gap-1 mt-1.5 relative">
            {!isFirst && !step.is_joint && (
              <button
                className="flex-1 text-[9px] bg-gray-400 text-white px-1 py-0.5 rounded font-medium transition-all duration-150 ease-out hover:bg-gray-500 hover:scale-[1.03] active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  onStepReturn(step.id);
                }}
              >
                Return
              </button>
            )}
            <button
              className="flex-1 text-[9px] bg-green-500 text-white px-1 py-0.5 rounded font-medium transition-all duration-150 ease-out hover:bg-green-600 hover:scale-[1.03] active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                onStepComplete(step.id);
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-[100px] p-2 border-l border-gray-100 ${cellClass} ${isCurrentUser ? 'ring-2 ring-teal-300 ring-inset' : ''}`}>
      <div className="space-y-2">
        {/* Completed steps */}
        {completedSteps.map((step) => renderStepCard(step, 'completed'))}

        {/* Current/Active step */}
        {currentStep && renderStepCard(currentStep, 'active')}

        {/* Pending steps */}
        {pendingSteps.map((step) => renderStepCard(step, 'pending'))}
      </div>
    </div>
  );
}
