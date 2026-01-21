'use client';

import { useState, useEffect, useRef } from 'react';
import { PipelineStepWithMember, StepCommentWithMember, CommentAttachment } from '@/types';

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
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline editing state
  const [editingName, setEditingName] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [deadlineValue, setDeadlineValue] = useState('');

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

  // Handler for saving step name
  const handleSaveName = async () => {
    if (!step || !nameValue.trim() || nameValue === step.name) {
      setEditingName(false);
      return;
    }
    try {
      const res = await fetch(`/api/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setStep({ ...step, name: nameValue.trim() });
      onStepCompleted(); // Refresh the dashboard
    } catch (err) {
      setError('Failed to update step name');
    }
    setEditingName(false);
  };

  // Handler for saving step deadline
  const handleSaveDeadline = async () => {
    if (!step) {
      setEditingDeadline(false);
      return;
    }
    const newDeadline = deadlineValue || null;
    if (newDeadline === step.mini_deadline) {
      setEditingDeadline(false);
      return;
    }
    try {
      const res = await fetch(`/api/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mini_deadline: newDeadline }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setStep({ ...step, mini_deadline: newDeadline });
      onStepCompleted(); // Refresh the dashboard
    } catch (err) {
      setError('Failed to update deadline');
    }
    setEditingDeadline(false);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAttachments([...attachments, data.attachment]);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploading(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && attachments.length === 0) || !currentMemberId) return;

    setSubmittingComment(true);

    try {
      const res = await fetch(`/api/steps/${stepId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: currentMemberId,
          content: newComment || '(Attachment)',
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setComments([...comments, data.comment]);
      setNewComment('');
      setAttachments([]);
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
              <div className="flex-1 mr-4">
                {/* Editable step name */}
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onBlur={handleSaveName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') { setNameValue(step.name); setEditingName(false); }
                      }}
                      className="flex-1 text-xl font-bold px-2 py-1 border border-teal-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                      autoFocus
                    />
                  </div>
                ) : (
                  <h2
                    className="text-xl font-bold text-gray-900 cursor-pointer hover:bg-teal-50 px-2 py-1 -mx-2 -my-1 rounded transition-colors group inline-flex items-center gap-2"
                    onClick={() => { setNameValue(step.name); setEditingName(true); }}
                    title="Click to edit step name"
                  >
                    {step.name}
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </h2>
                )}
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
              {/* Editable deadline */}
              <div>
                <span className="text-sm text-gray-500">Deadline:</span>
                {editingDeadline ? (
                  <span className="ml-2 inline-flex items-center gap-2">
                    <input
                      type="date"
                      value={deadlineValue}
                      onChange={(e) => setDeadlineValue(e.target.value)}
                      onBlur={handleSaveDeadline}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDeadline();
                        if (e.key === 'Escape') { setDeadlineValue(step.mini_deadline || ''); setEditingDeadline(false); }
                      }}
                      className="text-sm px-2 py-1 border border-teal-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                      autoFocus
                    />
                    {deadlineValue && (
                      <button
                        onClick={() => { setDeadlineValue(''); handleSaveDeadline(); }}
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="Clear deadline"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </span>
                ) : (
                  <span
                    className="ml-2 text-sm font-medium cursor-pointer hover:bg-teal-50 px-2 py-1 -my-1 rounded transition-colors group inline-flex items-center gap-1"
                    onClick={() => { setDeadlineValue(step.mini_deadline || ''); setEditingDeadline(true); }}
                    title="Click to edit deadline"
                  >
                    {step.mini_deadline ? (
                      new Date(step.mini_deadline).toLocaleDateString()
                    ) : (
                      <span className="text-gray-400">+ Add deadline</span>
                    )}
                    <svg className="w-3 h-3 text-gray-300 group-hover:text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                )}
              </div>
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

            {/* Comments section - continuous flow across all steps */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-medium text-gray-900">Pipeline Notes</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  Flows across all steps
                </span>
              </div>

              {comments.length === 0 ? (
                <p className="text-sm text-gray-500 mb-4">No notes yet. Add notes to share context with team members across the pipeline.</p>
              ) : (
                <div className="space-y-3 mb-4 max-h-56 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className={`rounded-lg p-3 ${comment.step_id === stepId ? 'bg-teal-50 border border-teal-100' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium">{comment.member.name}</span>
                        {comment.step && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${comment.step_id === stepId ? 'bg-teal-200 text-teal-800' : 'bg-gray-200 text-gray-600'}`}>
                            Step {comment.step.step_order}: {comment.step.name}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString()} {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                      {/* Display attachments */}
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {comment.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 hover:border-teal-300 transition-colors"
                            >
                              {att.type === 'image' ? (
                                <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              )}
                              <span className="max-w-[120px] truncate">{att.name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pending attachments preview */}
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-1.5 text-xs bg-teal-50 border border-teal-200 rounded px-2 py-1">
                      {att.type === 'image' ? (
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      )}
                      <span className="max-w-[100px] truncate">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
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
                    placeholder="Add a note..."
                    className="input-field flex-1"
                  />
                  {/* File upload button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1 text-gray-600"
                    title="Attach file (max 5MB)"
                  >
                    {uploading ? (
                      <span className="spinner w-4 h-4" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="submit"
                    disabled={(!newComment.trim() && attachments.length === 0) || submittingComment}
                    className="btn-primary px-4"
                  >
                    {submittingComment ? <span className="spinner" /> : 'Post'}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  @name to notify • Attach files up to 5MB • Notes flow to all steps in this pipeline
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
