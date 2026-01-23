'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { useNav } from '@/context/NavContext';
import type { ExtractedTaskData, Member, TaskRecurrence } from '@/types';

// Wrapper component to handle Suspense requirement for useSearchParams
export default function AddLogPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="spinner" /></div>}>
      <AddLogPageContent />
    </Suspense>
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  extracted_data: ExtractedTaskData;
  matched_members: { step_index: number; member_id: string; member_name: string }[];
  unmatched_names: string[];
  ai_message: string;
  ready_to_create: boolean;
  suggested_new_members: string[];
  team_members: Member[];
}

// User-confirmed assignment for a step
interface ConfirmedAssignment {
  stepIndex: number;
  memberId: string | null;  // null = create new member
  memberName: string;       // Display name (from team or extracted)
  isConfirmed: boolean;     // Has user explicitly confirmed?
  extractedName: string | null; // Original name from AI
  // Joint task support
  isJoint: boolean;
  additionalMemberIds: (string | null)[]; // Additional assignees for joint tasks
  additionalMemberNames: string[];
  additionalExtractedNames: string[];
}

// Helper to safely format dates
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
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

function AddLogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { teamId, team, member } = useNav();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track if we're loading from a duplicate
  const [loadingDuplicate, setLoadingDuplicate] = useState(false);
  const [duplicateSourceTitle, setDuplicateSourceTitle] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Current extraction state
  const [extractedData, setExtractedData] = useState<ExtractedTaskData | null>(null);
  const [matchedMembers, setMatchedMembers] = useState<AIResponse['matched_members']>([]);
  const [readyToCreate, setReadyToCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Member confirmation state
  const [teamMembers, setTeamMembers] = useState<Member[]>([]);
  const [confirmedAssignments, setConfirmedAssignments] = useState<ConfirmedAssignment[]>([]);

  // Recurrence state
  const [recurrence, setRecurrence] = useState<TaskRecurrence | null>(null);
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);
  const [customInterval, setCustomInterval] = useState(1);
  const [customType, setCustomType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      if (!teamId || !member) {
        router.push('/select-business');
        return;
      }
    }
    checkAuth();
  }, [router, teamId, member]);

  // Handle duplicateFrom query parameter - load existing task as template
  useEffect(() => {
    const duplicateFromId = searchParams.get('duplicateFrom');
    if (!duplicateFromId || !teamId) return;

    async function loadDuplicateSource() {
      setLoadingDuplicate(true);
      try {
        // Fetch the original task with its steps
        const res = await fetch(`/api/tasks/${duplicateFromId}`);
        if (!res.ok) throw new Error('Failed to load task');
        const task = await res.json();

        if (!task || !task.id) throw new Error('Task not found');

        setDuplicateSourceTitle(task.title);

        // Fetch team members for assignment dropdowns
        const membersRes = await fetch(`/api/members?teamId=${teamId}`);
        const membersData = await membersRes.json();
        const teamMembersList = membersData.members || [];
        setTeamMembers(teamMembersList);

        // Convert task to ExtractedTaskData format
        const extractedFromTask: ExtractedTaskData = {
          title: `Copy of ${task.title}`,
          deadline: undefined, // Clear deadline for fresh start
          pipeline_steps: task.pipeline_steps.map((step: { name: string; assigned_to: string | null; mini_deadline: string | null; is_joint?: boolean; additional_assignees?: string[]; member?: { name: string } }) => ({
            name: step.name,
            assigned_to_name: step.member?.name || undefined,
            mini_deadline: undefined, // Clear mini deadlines for fresh start
            is_joint: step.is_joint || false,
          })),
          recurrence: task.recurrence || undefined,
          confidence: 'high', // Pre-filled from existing task
        };

        setExtractedData(extractedFromTask);
        setRecurrence(task.recurrence || null);
        setReadyToCreate(true);

        // Set up confirmed assignments from existing task
        const assignments: ConfirmedAssignment[] = task.pipeline_steps.map((step: { assigned_to: string | null; member?: { name: string }; is_joint?: boolean; additional_assignees?: string[]; additional_members?: { id: string; name: string }[] }, index: number) => ({
          stepIndex: index,
          memberId: step.assigned_to,
          memberName: step.member?.name || '',
          isConfirmed: !!step.assigned_to,
          extractedName: step.member?.name || null,
          isJoint: step.is_joint || false,
          additionalMemberIds: step.additional_assignees || [],
          additionalMemberNames: step.additional_members?.map(m => m.name) || [],
          additionalExtractedNames: step.additional_members?.map(m => m.name) || [],
        }));
        setConfirmedAssignments(assignments);

        // Add a message explaining this is a duplicate
        setMessages([
          { role: 'assistant', content: `I've loaded "${task.title}" as a template. You can modify the title, steps, assignments, and deadlines before creating the new pipeline. Click "Confirm & Log" when ready, or chat with me to make changes.` }
        ]);

      } catch (err) {
        console.error('Failed to load duplicate source:', err);
        setError('Failed to load pipeline template');
      }
      setLoadingDuplicate(false);
    }

    loadDuplicateSource();
  }, [searchParams, teamId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount (unless loading duplicate)
  useEffect(() => {
    if (!loadingDuplicate) {
      inputRef.current?.focus();
    }
  }, [loadingDuplicate]);

  const sendMessage = async (userMessage?: string) => {
    const messageToSend = userMessage || input.trim();
    if (!messageToSend || !teamId) return;

    const newUserMessage: ChatMessage = { role: 'user', content: messageToSend };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, teamId }),
      });

      const data: AIResponse = await res.json();
      if (!res.ok) throw new Error(data.ai_message || 'Failed to process');

      // Add AI response to chat
      const aiMessage: ChatMessage = { role: 'assistant', content: data.ai_message };
      setMessages([...updatedMessages, aiMessage]);

      // Update extraction state
      setExtractedData(data.extracted_data);
      setMatchedMembers(data.matched_members);
      setReadyToCreate(data.ready_to_create);
      setTeamMembers(data.team_members || []);

      // Set recurrence from AI extraction (if detected)
      if (data.extracted_data.recurrence) {
        setRecurrence(data.extracted_data.recurrence);
      }

      // Initialize confirmed assignments from AI matches
      const initialAssignments: ConfirmedAssignment[] = data.extracted_data.pipeline_steps.map((step, index) => {
        const match = data.matched_members.find(m => m.step_index === index);

        // Handle additional assignees for joint tasks
        const additionalNames = step.additional_assignee_names || [];
        const additionalMatches = additionalNames.map(name => {
          // Try to find a matching team member for each additional name
          const found = data.team_members?.find((m: Member) =>
            m.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(m.name.toLowerCase())
          );
          return found ? { id: found.id, name: found.name } : { id: null, name };
        });

        return {
          stepIndex: index,
          memberId: match?.member_id || null,
          memberName: match?.member_name || step.assigned_to_name || '',
          isConfirmed: !!match, // Auto-confirmed if AI found a match
          extractedName: step.assigned_to_name || null,
          // Joint task fields
          isJoint: step.is_joint || false,
          additionalMemberIds: additionalMatches.map(m => m.id),
          additionalMemberNames: additionalMatches.map(m => m.name),
          additionalExtractedNames: additionalNames,
        };
      });
      setConfirmedAssignments(initialAssignments);
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

  const handleCreateTask = async () => {
    if (!extractedData || !teamId) return;

    setCreating(true);
    setError('');

    try {
      // Build member assignments from USER-CONFIRMED selections (not just AI matches)
      const memberAssignments = extractedData.pipeline_steps.map((_, index) => {
        const confirmed = confirmedAssignments.find(a => a.stepIndex === index);
        return {
          memberId: confirmed?.memberId || null,
          isJoint: confirmed?.isJoint || false,
          additionalMemberIds: confirmed?.additionalMemberIds || [],
        };
      });

      // Include recurrence in extracted data
      const dataWithRecurrence = {
        ...extractedData,
        recurrence: recurrence || undefined,
      };

      const res = await fetch('/api/ai/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          createdBy: member?.id,
          extractedData: dataWithRecurrence,
          memberAssignments,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      setCreating(false);
    }
  };

  // Handle user changing a member assignment
  const handleAssignmentChange = (stepIndex: number, memberId: string | null, memberName: string) => {
    setConfirmedAssignments(prev => {
      const updated = [...prev];
      const existing = updated.findIndex(a => a.stepIndex === stepIndex);
      if (existing >= 0) {
        updated[existing] = {
          ...updated[existing],
          memberId,
          memberName,
          isConfirmed: true,
        };
      }
      return updated;
    });
  };

  // Handle user changing an additional assignee (for joint tasks)
  const handleAdditionalAssignmentChange = (stepIndex: number, additionalIndex: number, memberId: string | null, memberName: string) => {
    setConfirmedAssignments(prev => {
      const updated = [...prev];
      const existing = updated.findIndex(a => a.stepIndex === stepIndex);
      if (existing >= 0) {
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

  const hasExtractedData = extractedData && extractedData.pipeline_steps.length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* FROZEN Header */}
      <header className="header-banner shrink-0">
        <div className="header-banner-content px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Add Log</h1>
              <p className="text-teal-100 text-xs">{team?.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content - Two column layout */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT PANEL - Task Preview (frozen with own scroll) */}
        <div className={`${hasExtractedData ? 'w-1/3 min-w-[300px] max-w-[400px]' : 'w-0'} transition-all duration-300 border-r border-gray-200 bg-white flex flex-col overflow-hidden`}>
          {hasExtractedData && (
            <>
              {/* Preview header - frozen */}
              <div className="shrink-0 px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Pipeline Preview
                </h3>
              </div>

              {/* Preview content - scrollable */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Task title */}
                <h2 className="text-base font-semibold text-gray-900 mb-1">
                  {extractedData.title}
                </h2>

                {/* Due date */}
                <p className="text-xs text-gray-500 mb-2">
                  Due: {formatDate(extractedData.deadline)}
                </p>

                {/* Recurrence dropdown */}
                <div className="mb-3">
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

                {/* Pipeline steps with member confirmation */}
                <div className="space-y-2">
                  {extractedData.pipeline_steps.map((step, i) => {
                    const confirmed = confirmedAssignments.find(a => a.stepIndex === i);
                    const hasMatch = confirmed?.memberId !== null;
                    const hasExtractedName = !!step.assigned_to_name;

                    return (
                      <div
                        key={i}
                        className={`p-2 rounded-lg text-xs ${
                          hasMatch
                            ? 'bg-teal-50 border border-teal-200'
                            : hasExtractedName
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`font-medium flex-1 ${
                            hasMatch ? 'text-teal-800' : hasExtractedName ? 'text-amber-800' : 'text-gray-700'
                          }`}>
                            {i + 1}. {step.name}
                          </p>
                          <span className="text-gray-400 shrink-0 text-[10px]">
                            {formatDate(step.mini_deadline)}
                          </span>
                        </div>

                        {/* Member assignment dropdown */}
                        {hasExtractedName && (
                          <div className="mt-1.5">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[10px] text-gray-500">AI found:</span>
                              <span className={`text-[10px] font-medium ${hasMatch ? 'text-teal-600' : 'text-amber-600'}`}>
                                &quot;{step.assigned_to_name}&quot;
                              </span>
                              {!hasMatch && (
                                <span className="text-[10px] text-amber-500">(new)</span>
                              )}
                            </div>
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
                              className={`w-full text-xs p-1.5 rounded border ${
                                hasMatch
                                  ? 'border-teal-300 bg-white text-teal-800'
                                  : 'border-amber-300 bg-white text-amber-800'
                              } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                            >
                              <option value="__new__">
                                ➕ Create &quot;{step.assigned_to_name}&quot; as new member
                              </option>
                              <optgroup label="Existing team members">
                                {teamMembers.filter(m => !m.is_archived).map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} {m.name.toLowerCase().includes(step.assigned_to_name?.toLowerCase() || '') ? '✓' : ''}
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
                                        {!hasAddMatch && (
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
                                        className={`w-full text-xs p-1.5 rounded border ${
                                          hasAddMatch
                                            ? 'border-teal-300 bg-white text-teal-800'
                                            : 'border-amber-300 bg-white text-amber-800'
                                        } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                                      >
                                        <option value="__new__">
                                          ➕ Create &quot;{addName}&quot; as new member
                                        </option>
                                        <optgroup label="Existing team members">
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
                          </div>
                        )}

                        {/* No name extracted - show assignment dropdown */}
                        {!hasExtractedName && (
                          <div className="mt-1.5">
                            <select
                              value={confirmed?.memberId || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  const selectedMember = teamMembers.find(m => m.id === val);
                                  handleAssignmentChange(i, val, selectedMember?.name || '');
                                } else {
                                  handleAssignmentChange(i, null, '');
                                }
                              }}
                              className="w-full text-xs p-1.5 rounded border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
              </div>

              {/* Confirm button - frozen at bottom */}
              <div className="shrink-0 p-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleCreateTask}
                  disabled={creating}
                  className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <span className="spinner" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Confirm & Log
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL - Chat */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Chat messages - scrollable area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-4">
              {error && (
                <div className="bg-red-50 text-red-700 p-2 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-teal-500/20">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>

                  {/* Heading */}
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">What&apos;s the pipeline?</h2>
                  <p className="text-sm text-gray-500 mb-8">Describe it naturally — I&apos;ll extract the steps and people</p>

                  {/* Example card */}
                  <button
                    onClick={() => setInput("Website redesign project - Alex creates wireframes by Friday, then Sam builds the frontend next week, finally Jordan reviews and deploys by month end.")}
                    className="group w-full max-w-md text-left"
                  >
                    <div className="glass-card rounded-xl p-5 border-2 border-transparent hover:border-teal-200 hover:shadow-lg transition-all duration-200">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">Example</span>
                        <span className="text-xs text-gray-400">Click to use</span>
                      </div>
                      <p className="text-gray-700 leading-relaxed">
                        &quot;Website redesign project — <span className="text-teal-600 font-medium">Alex</span> creates wireframes by <span className="text-amber-600 font-medium">Friday</span>, then <span className="text-teal-600 font-medium">Sam</span> builds the frontend <span className="text-amber-600 font-medium">next week</span>, finally <span className="text-teal-600 font-medium">Jordan</span> reviews and deploys by <span className="text-amber-600 font-medium">month end</span>.&quot;
                      </p>
                      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>3 people</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span>3 steps</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>3 deadlines</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Subtle hint */}
                  <p className="text-xs text-gray-400 mt-6">Or just start typing below</p>
                </div>
              ) : (
                /* Chat messages */
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
                            : 'glass-card text-gray-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="glass-card rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="spinner" />
                          <span className="text-gray-500">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* FROZEN Input area at bottom */}
          <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
            <div className="max-w-2xl mx-auto">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={messages.length === 0
                    ? "Describe your pipeline..."
                    : "Reply to clarify..."
                  }
                  className="input-field flex-1 resize-none text-sm py-2"
                  rows={2}
                  disabled={loading}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="btn-primary px-4 py-2 flex items-center gap-1 shrink-0"
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
              {messages.length > 0 && hasExtractedData && (
                <p className="text-xs text-gray-400 mt-1">
                  Keep chatting to refine • Preview updates on the left
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
