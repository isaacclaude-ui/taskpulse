'use client';

import { PipelineStepWithMember, Member } from '@/types';

interface StepCellProps {
  step?: PipelineStepWithMember;
  members: Member[];
  onClick: () => void;
  currentMemberId?: string;
}

export default function StepCell({ step, members, onClick, currentMemberId }: StepCellProps) {
  if (!step) {
    return <div className="bg-gray-50 min-h-[80px]" />;
  }

  const assignedMember = step.member || members.find((m) => m.id === step.assigned_to);
  const isAssignedToMe = currentMemberId && step.assigned_to === currentMemberId;
  const canClick = step.status !== 'locked';

  const statusClasses = {
    locked: 'step-locked cursor-not-allowed',
    unlocked: 'step-unlocked cursor-pointer hover:bg-amber-100',
    completed: 'step-completed cursor-pointer hover:bg-emerald-100',
  };

  return (
    <div
      className={`bg-white min-h-[80px] p-3 transition-colors ${statusClasses[step.status]}`}
      onClick={canClick ? onClick : undefined}
      role={canClick ? 'button' : undefined}
      tabIndex={canClick ? 0 : undefined}
    >
      <div className="flex flex-col h-full justify-between">
        <div>
          <div className="text-sm font-medium text-gray-900 truncate" title={step.name}>
            {step.name}
          </div>
          {assignedMember && (
            <div className={`text-xs mt-1 ${isAssignedToMe ? 'text-teal-700 font-medium' : 'text-gray-500'}`}>
              {isAssignedToMe ? 'You' : assignedMember.name}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          {/* Status indicator */}
          <span className={`status-badge status-badge-${step.status}`}>
            {step.status === 'locked' && (
              <>
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Locked
              </>
            )}
            {step.status === 'unlocked' && (
              <>
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                In Progress
              </>
            )}
            {step.status === 'completed' && (
              <>
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Done
              </>
            )}
          </span>

          {/* Mini deadline */}
          {step.mini_deadline && step.status !== 'completed' && (
            <span className="text-xs text-gray-400">
              {new Date(step.mini_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
