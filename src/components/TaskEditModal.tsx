'use client';

import { useState, useEffect, useRef } from 'react';
import type { TaskWithSteps, ExtractedTaskData, Member, TaskRecurrence } from '@/types';

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
  // Joint task support
  isJoint: boolean;
  additionalMemberIds: (string | null)[];
  additionalMemberNames: string[];
  additionalExtractedNames: string[];
}

interface TaskEditModalProps {
  task: TaskWithSteps | null;
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  onTaskUpdated: () => void;
}

// Helper to format dates for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
}

// Helper to convert date to YYYY-MM-DD for input fields
function toInputDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

// Normalize extracted data dates to YYYY-MM-DD format for inputs
function normalizeExtractedDates(data: ExtractedTaskData): ExtractedTaskData {
  return {
    ...data,
    deadline: toInputDate(data.deadline),
    pipeline_steps: data.pipeline_steps.map(step => ({
      ...step,
      mini_deadline: toInputDate(step.mini_deadline),
    })),
  };
}

// Helper to format recurrence for display
function formatRecurrence(rec: TaskRecurrence | null): string {
  if (!rec || !rec.enabled) return "Don't repeat";
  const { type, interval } = rec;
  if (interval === 1) {
    if (type === 'daily') return 'Every day';
    if (type === 'weekly') return 'Every week';
    if (type === 'monthly') return 'Every month';
  }
  if (type === 'daily') return `Every ${interval} days`;
  if (type === 'weekly') return `Every ${interval} weeks`;
  if (type === 'monthly') return `Every ${interval} months`;
  return "Don't repeat";
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

  // Recurrence state
  const [recurrence, setRecurrence] = useState<TaskRecurrence | null>(null);
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);
  const [customInterval, setCustomInterval] = useState(1);
  const [customType, setCustomType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Initialize with current task data when modal opens
  useEffect(() => {
    if (isOpen && task) {
      // Convert task to extracted data format
      const rawData: ExtractedTaskData = {
        title: task.title,
        conclusion: task.conclusion,
        deadline: task.deadline,
        recurrence: task.recurrence,
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
      // Normalize dates to YYYY-MM-DD for input fields
      setExtractedData(normalizeExtractedDates(rawData));

      // Initialize recurrence from task
      setRecurrence(task.recurrence || null);

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
        // Joint task fields
        isJoint: step.is_joint || false,
        additionalMemberIds: step.additional_assignees || [],
        additionalMemberNames: step.additional_assignee_names || [],
        additionalExtractedNames: step.additional_assignee_names || [],
      }));
      setConfirmedAssignments(initialAssignments);

      // Fetch team members
      fetchTeamMembers();

      // Start with an initial AI message
      const recurrenceHint = task.recurrence?.enabled
        ? `\n• "Make this monthly instead" or "Turn off recurrence"`
        : `\n• "Make this repeat weekly"`;
      setMessages([{
        role: 'assistant',
        content: `Current pipeline: "${task.title}" with ${task.pipeline_steps.length} steps. What would you like to change? You can say things like:\n• "Change Lisa's deadline to Feb 20th"\n• "John resigned, Isaac takes over"\n• "Mark step 1 as completed"\n• "Add a new step for review"${recurrenceHint}`
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

  // Handle user changing an additional assignee (for joint tasks)
  const handleAdditionalAssignmentChange = (stepIndex: number, additionalIndex: number, memberId: string | null, memberName: string) => {
    setConfirmedAssignments(prev => {
      const updated = [...prev];
      const existing = updated.findIndex(a => a.stepIndex === stepIndex);
      if (existing >= 0 && !updated[existing].isLocked) {
        const newAdditionalMemberIds = [...updated[existing].additionalMemberIds];
        const newAdditionalMemberNames = [...updated[existing].additionalMemberNames];
        newAdditionalMemberIds[additionalIndex] = memberId;
        newAdditionalMemberNames[additionalIndex] = memberName;
        updated[existing] = {
          ...updated[existing],
          additionalMemberIds: newAdditionalMemberIds,
          additionalMemberNames: newAdditionalMemberNames,
        };
      }
      return updated;
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

      // Update extraction state (normalize dates for input fields)
      const normalizedData = normalizeExtractedDates(data.extracted_data);
      setExtractedData(normalizedData);
      setMatchedMembers(data.matched_members || []);

      // Update confirmedAssignments with new joint task info from AI
      setConfirmedAssignments(prev => {
        return normalizedData.pipeline_steps.map((step, index) => {
          const existing = prev.find(a => a.stepIndex === index);
          const match = data.matched_members?.find((m: { step_index: number }) => m.step_index === index);

          return {
            stepIndex: index,
            memberId: match?.member_id || existing?.memberId || null,
            memberName: match?.member_name || existing?.memberName || step.assigned_to_name || '',
            isConfirmed: !!match || existing?.isConfirmed || false,
            extractedName: step.assigned_to_name || null,
            isLocked: existing?.isLocked || step.status === 'completed',
            // Update joint task fields from AI response
            isJoint: step.is_joint || false,
            additionalMemberIds: existing?.additionalMemberIds || [],
            additionalMemberNames: step.additional_assignee_names || [],
            additionalExtractedNames: step.additional_assignee_names || [],
          };
        });
      });
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
      // Build member assignments with joint task support
      const memberAssignments = extractedData.pipeline_steps.map((_, index) => {
        const match = matchedMembers.find(m => m.step_index === index);
        const confirmed = confirmedAssignments.find(a => a.stepIndex === index);
        return {
          memberId: match?.member_id || confirmed?.memberId || null,
          isJoint: confirmed?.isJoint || false,
          additionalMemberIds: confirmed?.additionalMemberIds || [],
        };
      });

      // Include recurrence in extracted data
      const dataWithRecurrence = {
        ...extractedData,
        recurrence: recurrence || undefined,
      };

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedData: dataWithRecurrence,
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
                  {/* Editable Title */}
                  <input
                    type="text"
                    value={extractedData.title}
                    onChange={(e) => setExtractedData({ ...extractedData, title: e.target.value })}
                    className="font-medium text-gray-900 text-sm w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-teal-500 focus:outline-none rounded px-1 py-0.5 -mx-1"
                    placeholder="Pipeline title"
                  />
                  {/* Editable Deadline */}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-gray-500">Due:</span>
                    <input
                      type="date"
                      value={extractedData.deadline || ''}
                      onChange={(e) => setExtractedData({ ...extractedData, deadline: e.target.value || undefined })}
                      className="text-xs text-gray-700 bg-transparent border border-transparent hover:border-gray-300 focus:border-teal-500 focus:outline-none rounded px-1 py-0.5"
                    />
                  </div>

                  {/* Recurrence dropdown */}
                  <div className="mt-2">
                    <label className="text-[10px] text-gray-500 block mb-1">Repeat</label>
                    {!showCustomRecurrence ? (
                      <select
                        value={recurrence ? `${recurrence.type}-${recurrence.interval}` : 'none'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'none') {
                            setRecurrence(null);
                          } else if (val === 'custom') {
                            setShowCustomRecurrence(true);
                          } else {
                            const [type, interval] = val.split('-');
                            setRecurrence({
                              type: type as 'daily' | 'weekly' | 'monthly',
                              interval: parseInt(interval, 10),
                              enabled: true,
                            });
                          }
                        }}
                        className="w-full text-xs p-1.5 rounded border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="none">Don&apos;t repeat</option>
                        <option value="weekly-1">Every week</option>
                        <option value="weekly-2">Every 2 weeks</option>
                        <option value="monthly-1">Every month</option>
                        <option value="daily-1">Every day</option>
                        <option value="custom">Custom...</option>
                      </select>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Every</span>
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={customInterval}
                            onChange={(e) => setCustomInterval(parseInt(e.target.value, 10) || 1)}
                            className="w-14 text-xs p-1 rounded border border-gray-300 text-center"
                          />
                          <select
                            value={customType}
                            onChange={(e) => setCustomType(e.target.value as 'daily' | 'weekly' | 'monthly')}
                            className="flex-1 text-xs p-1 rounded border border-gray-300"
                          >
                            <option value="daily">day(s)</option>
                            <option value="weekly">week(s)</option>
                            <option value="monthly">month(s)</option>
                          </select>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setRecurrence({
                                type: customType,
                                interval: customInterval,
                                enabled: true,
                              });
                              setShowCustomRecurrence(false);
                            }}
                            className="flex-1 text-xs py-1 bg-teal-500 text-white rounded hover:bg-teal-600"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => setShowCustomRecurrence(false)}
                            className="flex-1 text-xs py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {recurrence && (
                      <p className="text-[10px] text-teal-600 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {formatRecurrence(recurrence)}
                      </p>
                    )}
                  </div>

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
                              ? 'bg-gray-100 border border-gray-200 opacity-60'
                              : hasMatch
                              ? 'bg-teal-50 border border-teal-200'
                              : hasExtractedName
                              ? 'bg-amber-50 border border-amber-200'
                              : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              <span className={`font-medium shrink-0 ${isCompleted ? 'text-gray-500' : 'text-gray-700'}`}>
                                {i + 1}.
                              </span>
                              <input
                                type="text"
                                value={step.name}
                                onChange={(e) => {
                                  if (isLocked) return;
                                  const updated = [...extractedData.pipeline_steps];
                                  updated[i] = { ...updated[i], name: e.target.value };
                                  setExtractedData({ ...extractedData, pipeline_steps: updated });
                                }}
                                disabled={isLocked}
                                className={`font-medium flex-1 min-w-0 bg-transparent border border-transparent hover:border-gray-300 focus:border-teal-500 focus:outline-none rounded px-1 py-0.5 ${
                                  isCompleted ? 'text-gray-500 cursor-not-allowed' :
                                  hasMatch ? 'text-teal-800' :
                                  hasExtractedName ? 'text-amber-800' : 'text-gray-700'
                                }`}
                              />
                              {isCompleted && (
                                <span className="text-[10px] font-medium bg-gray-300 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
                                  DONE
                                </span>
                              )}
                            </div>
                            <input
                              type="date"
                              value={step.mini_deadline || ''}
                              onChange={(e) => {
                                if (isLocked) return;
                                const updated = [...extractedData.pipeline_steps];
                                updated[i] = { ...updated[i], mini_deadline: e.target.value || undefined };
                                setExtractedData({ ...extractedData, pipeline_steps: updated });
                              }}
                              disabled={isLocked}
                              className={`text-[10px] shrink-0 bg-transparent border border-transparent hover:border-gray-300 focus:border-teal-500 focus:outline-none rounded px-1 ${
                                isLocked ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500'
                              }`}
                            />
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

                              {/* Additional assignees for joint tasks */}
                              {confirmed?.isJoint && confirmed.additionalExtractedNames.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-teal-200/50">
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="text-[10px] text-purple-600 font-medium">Joint task — also assigned:</span>
                                  </div>
                                  {confirmed.additionalExtractedNames.map((addName, addIdx) => {
                                    const addMemberId = confirmed.additionalMemberIds[addIdx];
                                    const hasAddMatch = addMemberId !== null;
                                    return (
                                      <div key={addIdx} className="mt-1">
                                        <div className="flex items-center gap-1 mb-1">
                                          <span className="text-[10px] text-gray-500">AI found:</span>
                                          <span className={`text-[10px] font-medium ${hasAddMatch ? 'text-teal-600' : 'text-amber-600'}`}>
                                            &quot;{addName}&quot;
                                          </span>
                                          {!hasAddMatch && !isLocked && (
                                            <span className="text-[10px] text-amber-500">(new)</span>
                                          )}
                                        </div>
                                        <select
                                          value={addMemberId || '__new__'}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '__new__') {
                                              handleAdditionalAssignmentChange(i, addIdx, null, addName);
                                            } else {
                                              const selectedMember = teamMembers.find(m => m.id === val);
                                              handleAdditionalAssignmentChange(i, addIdx, val, selectedMember?.name || '');
                                            }
                                          }}
                                          disabled={isLocked}
                                          className={`w-full text-xs p-1.5 rounded border ${
                                            isLocked
                                              ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                                              : hasAddMatch
                                              ? 'border-teal-300 bg-white text-teal-800'
                                              : 'border-amber-300 bg-white text-amber-800'
                                          } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                                        >
                                          <option value="__new__">
                                            {isLocked ? addName : `➕ Create "${addName}" as new member`}
                                          </option>
                                          <optgroup label="Team members">
                                            {teamMembers.filter(m => !m.is_archived).map(m => (
                                              <option key={m.id} value={m.id}>
                                                {m.name} {m.name.toLowerCase().includes(addName.toLowerCase()) ? '✓' : ''}
                                              </option>
                                            ))}
                                          </optgroup>
                                        </select>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

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
