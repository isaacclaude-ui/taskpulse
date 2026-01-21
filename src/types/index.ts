// User roles
export type UserRole = 'admin' | 'lead' | 'user';

// Step status
export type StepStatus = 'locked' | 'unlocked' | 'completed';

// Task status
export type TaskStatus = 'active' | 'completed';

// Recurrence type
export type RecurrenceType = 'daily' | 'weekly' | 'monthly';

// Task recurrence pattern
export interface TaskRecurrence {
  type: RecurrenceType;
  interval: number; // every X days/weeks/months
  enabled: boolean;
}

// Business
export interface Business {
  id: string;
  name: string;
  created_at: string;
}

// Team
export interface Team {
  id: string;
  business_id: string;
  name: string;
  created_at: string;
}

// Member
export interface Member {
  id: string;
  business_id: string;
  name: string;
  email: string;
  role: UserRole;
  is_archived?: boolean;
  archived_at?: string;
  created_at: string;
}

// Member with role info for auth
export interface MemberWithRole {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  business_id: string;
}

// Member-Team junction
export interface MemberTeam {
  id: string;
  member_id: string;
  team_id: string;
  created_at: string;
}

// Task
export interface Task {
  id: string;
  team_id: string;
  title: string;
  description?: string;
  conclusion?: string;
  actionables?: string[];
  deadline?: string;
  status: TaskStatus;
  created_by?: string;
  created_at: string;
  completed_at?: string;
  // Recurrence fields
  recurrence?: TaskRecurrence;
  source_task_id?: string; // Links to original recurring task
  recurrence_count?: number; // Which cycle (0=original, 1=first repeat, etc.)
}

// Pipeline Step
export interface PipelineStep {
  id: string;
  task_id: string;
  step_order: number;
  name: string;
  assigned_to?: string;
  assigned_to_name?: string; // Original name from AI (Fundamental Sheet)
  additional_assignees?: string[]; // For joint tasks: ["member_id1", "member_id2"]
  additional_assignee_names?: string[]; // Raw AI names: ["George", "Ethan"]
  is_joint?: boolean; // True if multiple people can claim this step
  mini_deadline?: string;
  status: StepStatus;
  completed_at?: string;
  created_at: string;
}

// Step with assigned member info
export interface PipelineStepWithMember extends PipelineStep {
  member?: Member;
}

// Task with steps
export interface TaskWithSteps extends Task {
  pipeline_steps: PipelineStepWithMember[];
}

// Step Comment
export interface StepComment {
  id: string;
  step_id: string;
  member_id: string;
  content: string;
  attachments?: CommentAttachment[];
  created_at: string;
}

// Comment with member info
export interface StepCommentWithMember extends StepComment {
  member: Member;
}

// AI Conversation state
export interface AIConversation {
  id: string;
  session_id: string;
  raw_input: string;
  extracted_data?: ExtractedTaskData;
  pending_question?: string;
  question_count: number;
  created_at: string;
  updated_at: string;
}

// Extracted task data from AI
export interface ExtractedTaskData {
  title: string;
  summary?: string; // AI-generated workflow description
  conclusion?: string;
  actionables?: string[];
  deadline?: string;
  recurrence?: TaskRecurrence; // Recurrence pattern extracted from AI
  pipeline_steps: {
    name: string;
    assigned_to_name?: string;
    additional_assignee_names?: string[]; // For "X or Y" patterns
    is_joint?: boolean; // True if multiple people can claim
    mini_deadline?: string;
    status?: 'pending' | 'completed';
  }[];
  confidence: 'high' | 'medium' | 'low';
}

// AI extraction response
export interface AIExtractionResponse {
  success: boolean;
  extracted_data?: ExtractedTaskData;
  needs_clarification: boolean;
  clarifying_question?: string;
  session_id: string;
}

// Pending user (access request)
export interface PendingUser {
  id: string;
  email: string;
  business_id?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

// Notification for @mentions
export interface Notification {
  id: string;
  member_id: string;
  type: 'mention' | 'assignment' | 'comment';
  title: string;
  content?: string;
  link_task_id?: string;
  link_step_id?: string;
  is_read: boolean;
  created_by?: string;
  created_at: string;
}

// Comment attachment
export interface CommentAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
  size?: number;
}

// Dashboard data (tasks grouped for grid)
export interface DashboardData {
  tasks: TaskWithSteps[];
  members: Member[];
}

// Announcement
export interface Announcement {
  id: string;
  team_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  member?: Member;
}

// Shared Link
export interface SharedLink {
  id: string;
  team_id: string;
  title: string;
  description?: string;
  url: string;
  created_by: string;
  created_at: string;
  member?: Member;
}

// Navigation context
export interface NavContext {
  businessId: string | null;
  teamId: string | null;
  business?: Business;
  team?: Team;
}

// Email digest settings
export type EmailFrequency = 'daily' | 'weekly' | 'monthly' | 'none';

export interface EmailSettings {
  id: string;
  member_id: string;
  frequency: EmailFrequency;
  last_sent_at: string | null;
  created_at: string;
}

// Calendar Event
export interface CalendarEvent {
  id: string;
  team_id: string;
  event_date: string;
  title: string;
  color: string;
  created_by: string;
  created_at: string;
  member?: Member;
}
