'use client';

import { useState, useEffect } from 'react';
import { PipelineStepWithMember, StepCommentWithMember, Member } from '@/types';

interface StepDetailModalProps {
  stepId: string;
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  currentMemberId?: string;
  onStepCompleted: () => void;
}

export default function StepDetailModal({
  stepId,
  taskId,
  isOpen,
  onClose,
  currentMemberId,
  onStepCompleted,
}: StepDetailModalProps) {
  const [step, setStep] = useState<PipelineStepWithMember | null>(null);
  const [comments, setComments] = useState<StepCommentWithMember[]>([]);
  const [prevStep, setPrevStep] = useState<{ name: string; assigned_to_name?: string; member?: { name: string } } | null>(null);
  const [nextStep, setNextStep] = useState<{ name: string; assigned_to_name?: string; member?: { name: string } } | null>(null);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && stepId) {
      loadStepDetails();
    }
  }, [isOpen, stepId]);

  const loadStepDetails = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/steps/${stepId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setStep(data.step);
      setComments(data.comments || []);
      setPrevStep(data.prevStep || null);
      setNextStep(data.nextStep || null);
    } catch (err) {
      setError('Failed to load step details');
      console.error(err);
    }

    setLoading(false);
  };

  const handleComplete = async () => {
    if (!step || step.status !== 'unlocked') return;
    if (step.assigned_to && step.assigned_to !== currentMemberId) {
      setError('Only the assigned member can complete this step');
      return;
    }

    setCompleting(true);
    setError('');

    try {
      const res = await fetch(`/api/steps/${stepId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: currentMemberId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onStepCompleted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete step');
    }

    setCompleting(false);
  };

  const handleReturn = async () => {
    if (!step || step.status !== 'unlocked' || !returnReason.trim()) return;

    setReturning(true);
    setError('');

    try {
      const res = await fetch(`/api/steps/${stepId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: currentMemberId, reason: returnReason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onStepCompleted(); // Refresh the dashboard
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to return step');
    }

    setReturning(false);
    setShowReturnDialog(false);
    setReturnReason('');
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentMemberId) return;

    setSubmittingComment(true);

    try {
      const res = await fetch(`/api/steps/${stepId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: currentMemberId, content: newComment }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setComments([...comments, data.comment]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }

    setSubmittingComment(false);
  };

  if (!isOpen) return null;

  const canComplete =
    step?.status === 'unlocked' &&
    (!step.assigned_to || step.assigned_to === currentMemberId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="spinner" />
          </div>
        ) : step ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{step.name}</h2>
                <span className={`status-badge status-badge-${step.status} mt-2`}>
                  {step.status === 'locked' && 'Locked'}
                  {step.status === 'unlocked' && 'In Progress'}
                  {step.status === 'completed' && 'Completed'}
                </span>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step details */}
            <div className="space-y-3 mb-6">
              {step.member && (
                <div>
                  <span className="text-sm text-gray-500">Assigned to:</span>
                  <span className="ml-2 text-sm font-medium">{step.member.name}</span>
                </div>
              )}
              {step.mini_deadline && (
                <div>
                  <span className="text-sm text-gray-500">Deadline:</span>
                  <span className="ml-2 text-sm font-medium">
                    {new Date(step.mini_deadline).toLocaleDateString()}
                  </span>
                </div>
              )}
              {step.completed_at && (
                <div>
                  <span className="text-sm text-gray-500">Completed:</span>
                  <span className="ml-2 text-sm font-medium">
                    {new Date(step.completed_at).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Before/After workflow context */}
              <div className="bg-gray-50 rounded-lg p-3 mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Workflow</div>
                <div className="space-y-2">
                  {prevStep && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">←</span>
                      <span className="text-gray-500">Before:</span>
                      <span className="font-medium text-gray-700">{prevStep.name}</span>
                      {(prevStep.assigned_to_name || prevStep.member?.name) && (
                        <span className="text-gray-400">({prevStep.assigned_to_name || prevStep.member?.name})</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm font-medium text-teal-600 bg-teal-50 rounded px-2 py-1">
                    <span>●</span>
                    <span>Current: {step.name}</span>
                  </div>
                  {nextStep && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-500">After:</span>
                      <span className="font-medium text-gray-700">{nextStep.name}</span>
                      {(nextStep.assigned_to_name || nextStep.member?.name) && (
                        <span className="text-gray-400">({nextStep.assigned_to_name || nextStep.member?.name})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {/* Action buttons */}
            {canComplete && (
              <div className="mb-6 space-y-2">
                {/* Complete button */}
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {completing ? (
                    <span className="spinner" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Mark as Complete
                </button>

                {/* Return to previous button */}
                {prevStep && (
                  <button
                    onClick={() => setShowReturnDialog(true)}
                    className="w-full py-2 px-4 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                    </svg>
                    Return to {prevStep.assigned_to_name || prevStep.member?.name || 'Previous'}
                  </button>
                )}

                {/* Return dialog */}
                {showReturnDialog && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                    <p className="text-sm text-amber-800 mb-2">Why are you returning this step?</p>
                    <textarea
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="e.g., Missing information, needs revision..."
                      className="w-full p-2 text-sm border border-amber-200 rounded resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleReturn}
                        disabled={!returnReason.trim() || returning}
                        className="flex-1 py-1.5 bg-amber-500 text-white rounded text-sm hover:bg-amber-600 disabled:opacity-50"
                      >
                        {returning ? 'Returning...' : 'Confirm Return'}
                      </button>
                      <button
                        onClick={() => { setShowReturnDialog(false); setReturnReason(''); }}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comments section */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-medium text-gray-900 mb-3">Comments</h3>

              {comments.length === 0 ? (
                <p className="text-sm text-gray-500 mb-4">No comments yet</p>
              ) : (
                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{comment.member.name}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {/* Highlight @mentions */}
                        {comment.content.split(/(@\w+)/g).map((part, i) =>
                          part.startsWith('@') ? (
                            <span key={i} className="text-teal-600 font-medium">{part}</span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="input-field flex-1"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim() || submittingComment}
                    className="btn-primary px-4"
                  >
                    {submittingComment ? <span className="spinner" /> : 'Post'}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Tips: @name to notify someone • Paste links to reference files • Give heads up to someone down the workflow
                </p>
              </form>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">Step not found</div>
        )}
      </div>
    </div>
  );
}
