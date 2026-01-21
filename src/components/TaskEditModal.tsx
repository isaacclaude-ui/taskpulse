'use client';

import { useState, useEffect, useRef } from 'react';
import type { TaskWithSteps, ExtractedTaskData, Member } from '@/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// User-confirmed assignment for a step (same as add-log)
interface ConfirmedAssignment {
  stepIndex: number;
  memberId: string | null;
  memberName: string;
  isConfirmed: boolean;
  extractedName: string | null;
  isLocked: boolean; // NEW: Completed steps are locked
}

interface TaskEditModalProps {
  task: TaskWithSteps | null;
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  onTaskUpdated: () => void;
}

// Helper to format dates
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
}

export default function TaskEditModal({
  task,
  isOpen,
  onClose,
  teamId,
  onTaskUpdated
}: TaskEditModalProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Current extraction state (modified version of the task)
  const [extractedData, setExtractedData] = useState<ExtractedTaskData | null>(null);
  const [matchedMembers, setMatchedMembers] = useState<{ step_index: number; member_id: string; member_name: string }[]>([]);

  // Member confirmation state (same pattern as add-log)
  const [teamMembers, setTeamMembers] = useState<Member[]>([]);
  const [confirmedAssignments, setConfirmedAssignments] = useState<ConfirmedAssignment[]>([]);

  // Initialize with current task data when modal opens
  useEffect(() => {
    if (isOpen && task) {
      // Convert task to extracted data format
      const initialData: ExtractedTaskData = {
        title: task.title,
        conclusion: task.conclusion,
        deadline: task.deadline,
        pipeline_steps: task.pipeline_steps.map(step => ({
          name: step.name,
          assigned_to_name: step.assigned_to_name || step.member?.name || undefined,
          additional_assignee_names: step.additional_assignee_names,
          is_joint: step.is_joint,
          mini_deadline: step.mini_deadline,
          status: step.status === 'completed' ? 'completed' : 'pending',
        })),
        confidence: 'high',
      };
      setExtractedData(initialData);

      // Build matched members from existing assignments
      const matched = task.pipeline_steps
        .map((step, index) => ({
          step_index: index,
          member_id: step.assigned_to || '',
          member_name: step.member?.name || '',
        }))
        .filter(m => m.member_id);
      setMatchedMembers(matched);

      // Initialize confirmed assignments with preset data & lock completed steps
      const initialAssignments: ConfirmedAssignment[] = task.pipeline_steps.map((step, index) => ({
        stepIndex: index,
        memberId: step.assigned_to || null,
        memberName: step.member?.name || step.assigned_to_name || '',
        isConfirmed: !!step.assigned_to,
        extractedName: step.assigned_to_name || null,
        isLocked: step.status === 'completed', // Lock completed steps
      }));
      setConfirmedAssignments(initialAssignments);

      // Fetch team members
      fetchTeamMembers();

      // Start with an initial AI message
      setMessages([{
        role: 'assistant',
        content: `Current pipeline: "${task.title}" with ${task.pipeline_steps.length} steps. What would you like to change? You can say things like:\n• "Change Lisa's deadline to Feb 20th"\n• "John resigned, Isaac takes over"\n• "Mark step 1 as completed"\n• "Add a new step for review"`
      }]);

      setInput('');
      setError('');
    }
  }, [isOpen, task]);

  // Fetch team members for dropdowns
  const fetchTeamMembers = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`);
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to fetch team members:', err);
    }
  };

  // Handle user changing a member assignment
  const handleAssignmentChange = (stepIndex: number, memberId: string | null, memberName: string) => {
    setConfirmedAssignments(prev => {
      const updated = [...prev];
      const existing = updated.findIndex(a => a.stepIndex === stepIndex);
      if (existing >= 0 && !updated[existing].isLocked) {
        updated[existing] = {
          ...updated[existing],
          memberId,
          memberName,
          isConfirmed: true,
        };
      }
      return updated;
    });
    // Also update matchedMembers for the save
    setMatchedMembers(prev => {
      const filtered = prev.filter(m => m.step_index !== stepIndex);
      if (memberId) {
        filtered.push({ step_index: stepIndex, member_id: memberId, member_name: memberName });
      }
      return filtered;
    });
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || !task) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      // Send to AI with current task context
      const res = await fetch('/api/ai/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          teamId,
          taskId: task.id,
          currentData: extractedData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process');

      // Add AI response
      const aiMessage: ChatMessage = { role: 'assistant', content: data.ai_message };
      setMessages([...updatedMessages, aiMessage]);

      // Update extraction state
      setExtractedData(data.extracted_data);
      setMatchedMembers(data.matched_members || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process message');
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSaveChanges = async () => {
    if (!extractedData || !task) return;

    setSaving(true);
    setError('');

    try {
      // Build member assignments
      const memberAssignments = extractedData.pipeline_steps.map((_, index) => {
        const match = matchedMembers.find(m => m.step_index === index);
        return match?.member_id || null;
      });

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedData,
          memberAssignments,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update task');

      onTaskUpdated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    }

    setSaving(false);
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Pipeline with AI</h2>
            <p className="text-sm text-gray-500">Describe your changes in natural language</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Two columns */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left - Task Preview */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Updated Preview
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {extractedData && (
                <>
                  <h4 className="font-medium text-gray-900 text-sm">{extractedData.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Due: {formatDate(extractedData.deadline)}
                  </p>

                  <div className="mt-3 space-y-2">
                    {extractedData.pipeline_steps.map((step, i) => {
                      const confirmed = confirmedAssignments.find(a => a.stepIndex === i);
                      const isCompleted = step.status === 'completed';
                      const isLocked = confirmed?.isLocked || isCompleted;
                      const hasMatch = confirmed?.memberId !== null;
                      const hasExtractedName = !!step.assigned_to_name;

                      return (
                        <div
                          key={i}
                          className={`p-2 rounded text-xs ${
                            isCompleted
                              ? 'bg-emerald-50 border border-emerald-200'
                              : hasMatch
                              ? 'bg-teal-50 border border-teal-200'
                              : hasExtractedName
                              ? 'bg-amber-50 border border-amber-200'
                              : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`font-medium flex-1 ${
                              isCompleted ? 'text-emerald-700 line-through' :
                              hasMatch ? 'text-teal-800' :
                              hasExtractedName ? 'text-amber-800' : 'text-gray-700'
                            }`}>
                              {i + 1}. {step.name}
                              {isCompleted && (
                                <span className="ml-2 text-[10px] font-normal bg-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded">
                                  DONE
                                </span>
                              )}
                            </p>
                            <span className="text-gray-400 shrink-0 text-[10px]">
                              {formatDate(step.mini_deadline)}
                            </span>
                          </div>

                          {/* Member assignment dropdown - same as add-log */}
                          {(hasExtractedName || confirmed?.memberId) && (
                            <div className="mt-1.5">
                              {hasExtractedName && (
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="text-[10px] text-gray-500">
                                    {isLocked ? 'Assigned:' : 'AI found:'}
                                  </span>
                                  <span className={`text-[10px] font-medium ${
                                    isCompleted ? 'text-emerald-600' :
                                    hasMatch ? 'text-teal-600' : 'text-amber-600'
                                  }`}>
                                    &quot;{step.assigned_to_name}&quot;
                                  </span>
                                  {!hasMatch && !isLocked && (
                                    <span className="text-[10px] text-amber-500">(new)</span>
                                  )}
                                </div>
                              )}
                              <select
                                value={confirmed?.memberId || '__new__'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '__new__') {
                                    handleAssignmentChange(i, null, step.assigned_to_name || '');
                                  } else {
                                    const selectedMember = teamMembers.find(m => m.id === val);
                                    handleAssignmentChange(i, val, selectedMember?.name || '');
                                  }
                                }}
                                disabled={isLocked}
                                className={`w-full text-xs p-1.5 rounded border ${
                                  isLocked
                                    ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                                    : hasMatch
                                    ? 'border-teal-300 bg-white text-teal-800'
                                    : 'border-amber-300 bg-white text-amber-800'
                                } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                              >
                                {hasExtractedName && (
                                  <option value="__new__">
                                    {isLocked ? `${step.assigned_to_name}` : `➕ Create "${step.assigned_to_name}" as new member`}
                                  </option>
                                )}
                                <optgroup label="Team members">
                                  {teamMembers.filter(m => !m.is_archived).map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} {hasExtractedName && m.name.toLowerCase().includes(step.assigned_to_name?.toLowerCase() || '') ? '✓' : ''}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              {isLocked && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  Locked (step completed)
                                </p>
                              )}
                            </div>
                          )}

                          {/* No name - show dropdown to assign */}
                          {!hasExtractedName && !confirmed?.memberId && (
                            <div className="mt-1.5">
                              <select
                                value=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    const selectedMember = teamMembers.find(m => m.id === val);
                                    handleAssignmentChange(i, val, selectedMember?.name || '');
                                  }
                                }}
                                disabled={isLocked}
                                className={`w-full text-xs p-1.5 rounded border ${
                                  isLocked
                                    ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                                    : 'border-gray-300 bg-white text-gray-700'
                                } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                              >
                                <option value="">No one assigned</option>
                                {teamMembers.filter(m => !m.is_archived).map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Save button */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 shrink-0">
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span className="spinner" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Save Changes
              </button>
            </div>
          </div>

          {/* Right - Chat */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {error && (
                <div className="bg-red-50 text-red-700 p-2 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="spinner" />
                        <span className="text-gray-500">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-3 shrink-0">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what to change..."
                  className="input-field flex-1 resize-none text-sm py-2"
                  rows={2}
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="btn-primary px-4 py-2 shrink-0"
                >
                  {loading ? (
                    <span className="spinner" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
