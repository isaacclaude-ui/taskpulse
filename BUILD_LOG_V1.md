# TaskPulse BUILD_LOG v1.0

**One-liner:** Pipeline-based task management app where freeform notes become structured tasks on a team dashboard.

**Production URL:** https://taskpulse-nu.vercel.app

**Stack:** Next.js 16 + React 19 + Supabase + Groq AI + Tailwind CSS 4 + Resend + Vercel

---

## 1. Database Schema

### Complete SQL (Run in Supabase SQL Editor)

```sql
-- TaskPulse Database Schema v1.0
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Businesses table (top-level organizations)
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table (belong to businesses)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members table (users that can span teams)
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE, -- nullable for non-login users
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'lead', 'user')),
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for many-to-many members <-> teams
CREATE TABLE member_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, team_id)
);

-- Tasks table (main work items)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  conclusion TEXT,
  actionables TEXT[],
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  recurrence JSONB DEFAULT NULL, -- {"type": "daily"|"weekly"|"monthly", "interval": number, "enabled": boolean}
  source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  recurrence_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Pipeline steps (custom per task)
CREATE TABLE pipeline_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  assigned_to UUID REFERENCES members(id),
  assigned_to_name TEXT, -- Original name from AI (Fundamental Sheet)
  additional_assignees UUID[] DEFAULT '{}', -- For joint tasks
  additional_assignee_names TEXT[] DEFAULT '{}', -- Raw AI names
  is_joint BOOLEAN DEFAULT FALSE, -- Multiple people can claim
  mini_deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step comments (cell communication)
CREATE TABLE step_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  step_id UUID NOT NULL REFERENCES pipeline_steps(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI conversations (multi-turn state)
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL UNIQUE,
  raw_input TEXT NOT NULL,
  extracted_data JSONB,
  pending_question TEXT,
  question_count INTEGER DEFAULT 0,
  task_id UUID REFERENCES tasks(id),
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending users (access requests)
CREATE TABLE pending_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'mention',
  title TEXT NOT NULL,
  content TEXT,
  link_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  link_step_id UUID REFERENCES pipeline_steps(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  is_addressed BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email settings for digest notifications
CREATE TABLE email_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'none')),
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id)
);

-- Announcements table
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shared Links table
CREATE TABLE shared_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calendar Events table
CREATE TABLE calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  title VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#0d9488',
  created_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_teams_business ON teams(business_id);
CREATE INDEX idx_members_business ON members(business_id);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_name ON members(name);
CREATE INDEX idx_member_teams_member ON member_teams(member_id);
CREATE INDEX idx_member_teams_team ON member_teams(team_id);
CREATE INDEX idx_tasks_team ON tasks(team_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_pipeline_steps_task ON pipeline_steps(task_id);
CREATE INDEX idx_pipeline_steps_assigned ON pipeline_steps(assigned_to);
CREATE INDEX idx_steps_additional_assignees ON pipeline_steps USING GIN (additional_assignees) WHERE is_joint = TRUE;
CREATE INDEX idx_step_comments_step ON step_comments(step_id);
CREATE INDEX idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX idx_pending_users_email ON pending_users(email);
CREATE INDEX idx_notifications_member ON notifications(member_id);
CREATE INDEX idx_notifications_unread ON notifications(member_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_addressed ON notifications(member_id, is_addressed) WHERE is_addressed = FALSE;
CREATE INDEX idx_email_settings_member_id ON email_settings(member_id);
CREATE INDEX idx_announcements_team_id ON announcements(team_id);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_shared_links_team_id ON shared_links(team_id);
CREATE INDEX idx_shared_links_created_at ON shared_links(created_at DESC);
CREATE INDEX idx_calendar_events_team_id ON calendar_events(team_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX idx_calendar_events_team_date ON calendar_events(team_id, event_date);
```

---

## 2. Environment Variables

```bash
# Supabase (Database + Auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Groq AI (Task extraction)
GROQ_API_KEY=gsk_your_groq_key

# Resend (Email notifications)
RESEND_API_KEY=re_your_resend_key
RESEND_FROM_EMAIL=Task Pulse <noreply@yourdomain.com>

# App URL
NEXT_PUBLIC_APP_URL=https://taskpulse-nu.vercel.app

# Cron job security
CRON_SECRET=your_random_secret_string
```

---

## 3. Core Library Code

### `/src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null as unknown as ReturnType<typeof createClient>;
```

### `/src/lib/auth.ts`
Key functions:
- `signIn(email, password)` - Auth with Supabase
- `signUp(email, password)` - Register new user
- `signOut()` - Logout
- `getCurrentUser()` - Get current session user
- `getMemberWithRole(email)` - Get member with role info
- `isAdmin(email)` / `isLeadOrAdmin(email)` - Role checks
- `getMemberTeams(memberId)` - Get teams for member
- `requestAccess(email, joinCode?)` - Request to join business
- `getBusinessByJoinCode(joinCode)` - Look up business by code

### `/src/lib/groq.ts`
Key functions:
- `processTaskChat(messages, teamMembers, existingTask?)` - Multi-turn AI extraction
- `extractTaskFromNote(input, teamMembers)` - Quick single extraction
- `taskToFundamentalSheet(task, steps, memberMap)` - Convert DB task for AI editing
- `matchNameToMember(name, teamMembers)` - Case-insensitive name matching

AI Model: `llama-3.1-8b-instant` via Groq

---

## 4. API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/dashboard` | GET | Fetch tasks + steps for grid display |
| `/api/tasks/[id]` | PATCH, DELETE | Update or delete task |
| `/api/tasks/[id]/reopen` | POST | Reopen completed task |
| `/api/steps/[id]` | GET, PATCH | View or update step details |
| `/api/steps/[id]/complete` | POST | Mark done + unlock next step |
| `/api/steps/[id]/claim` | POST | Claim joint task step |
| `/api/steps/[id]/return` | POST | Return step to joint pool |
| `/api/steps/[id]/comments` | GET, POST | Step comments |
| `/api/ai/chat` | POST | Multi-turn AI extraction chat |
| `/api/ai/edit` | POST | Edit existing task via AI |
| `/api/ai/confirm` | POST | Create task from AI extraction |
| `/api/businesses` | GET, POST | List/create businesses |
| `/api/teams` | GET, POST | List/create teams |
| `/api/teams/[id]` | PATCH, DELETE | Update/delete team |
| `/api/teams/[id]/members` | GET, POST, DELETE | Manage team membership |
| `/api/members` | GET, POST | List/create members |
| `/api/members/[id]` | GET, PATCH, DELETE | View/update/delete member |
| `/api/members/[id]/teams` | GET | Get member's teams |
| `/api/notifications` | GET, PATCH | List/mark notifications |
| `/api/admin/pending-users` | GET, POST | Access request management |
| `/api/admin/email-settings` | GET, POST | Email digest settings |
| `/api/send-summary` | POST | Send email summary to member |
| `/api/cron/send-emails` | GET | Scheduled email digest (Vercel Cron) |
| `/api/announcements` | GET, POST | Team announcements |
| `/api/announcements/[id]` | PATCH, DELETE | Update/delete announcement |
| `/api/shared-links` | GET, POST | Team shared links |
| `/api/shared-links/[id]` | PATCH, DELETE | Update/delete link |
| `/api/calendar-events` | GET, POST | Team calendar events |
| `/api/calendar-events/[id]` | PATCH, DELETE | Update/delete event |
| `/api/teams/[id]/logo` | POST, DELETE | Upload/remove team logo |
| `/api/send-invite` | POST | Send invite email to member |

---

## 5. Page Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirect to dashboard or login |
| `/login` | Auth (signin/signup/request access with join code) |
| `/reset-password` | Password reset |
| `/select-business` | Choose business (multi-business support) |
| `/select-team` | Choose team within business |
| `/dashboard` | Main pipeline grid + announcements/links/calendar |
| `/add-log` | AI-powered task creation flow |
| `/notifications` | View and manage notifications |
| `/admin` | Manage businesses, teams, members, content |

---

## 6. Key Patterns

### Pipeline Logic
1. Step statuses: `locked` → `unlocked` → `completed`
2. First step starts as `unlocked`, rest are `locked`
3. Completing a step:
   - Verify assigned_to matches current user (or is admin/joint assignee)
   - Set status = `completed`, completed_at = now
   - Find next step (step_order + 1), set status = `unlocked`
   - If no next step, mark task as `completed`
4. Notifications sent to next step assignee when step unlocks

### Joint Tasks ("X or Y can do this")
- `is_joint = TRUE` with `additional_assignees[]` array
- Any assignee can "claim" the step
- Claiming sets `assigned_to` to claimer, clears `additional_assignees`, sets `is_joint = FALSE`
- Can "return" to pool if unclaimed

### Name Resolution Pattern (with Confirmation Step)
**Problem:** AI extracts names like "George" but if member is renamed to "George Tan", the match breaks.

**Solution:** Store `member_id` (immutable) not name string (mutable).

**Flow:**
```
User Input → AI Extracts Names → User Confirms Matches → Store member_id
                ↓                       ↓
         "George", "Sarah"      George Tan [dropdown ▼]
                                Sarah Wong [dropdown ▼]
```

**Implementation:**
1. AI extracts names as strings: `assigned_to_name`
2. Backend fuzzy-matches to team members (case-insensitive)
3. UI shows dropdown for each step - user confirms or changes match
4. On confirm, stores `member_id` (UUID) + keeps `assigned_to_name` (audit trail)
5. Display names via JOIN to members table (always current)

**State Management:**
```typescript
interface ConfirmedAssignment {
  stepIndex: number;
  memberId: string | null;  // null = create new member
  memberName: string;       // Display name
  isConfirmed: boolean;     // Has user explicitly confirmed?
  extractedName: string | null; // Original name from AI
}
```

**Inline Name Editing:** Admin can safely edit member names - all existing assignments still work because they reference `member_id`.

See full pattern: `~/BUILD_LOGS/patterns/name-resolution-confirmation.md`

### Role-Based Visibility
| Role | Sees |
|------|------|
| Admin | All tasks in their business |
| Lead | All tasks in their assigned teams |
| User | Only tasks where they have a step assigned |

---

## 7. External Services Setup

### Supabase
1. Create project at supabase.com
2. Go to SQL Editor, run schema SQL above
3. Enable Email auth in Auth > Providers
4. Copy Project URL and Anon Key to env vars

### Groq
1. Sign up at console.groq.com
2. Create API key
3. Copy to `GROQ_API_KEY`

### Resend
1. Sign up at resend.com
2. Verify domain (optional) or use test domain
3. Create API key
4. Copy to `RESEND_API_KEY`

### Vercel
1. Connect GitHub repo
2. Add all environment variables
3. Configure cron job in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/send-emails",
    "schedule": "0 8 * * *"
  }]
}
```

---

## 8. Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.90.1",
    "groq-sdk": "^0.37.0",
    "next": "16.1.4",
    "pg": "^8.17.1",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "resend": "^6.8.0",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/uuid": "^10.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.1.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

---

## 9. Rebuild Prompt

Use this prompt to have another Claude rebuild TaskPulse:

---

**Prompt:**

Build TaskPulse - a pipeline-based task management app where freeform notes become structured tasks.

**Stack:** Next.js 16, React 19, Supabase, Groq AI (llama-3.1-8b-instant), Tailwind CSS 4, Resend

**Core Concept:**
- User enters freeform note like "Maya writes blog by 15th, David creates graphics by 20th"
- AI extracts: title, steps with assignees, deadlines
- Creates task with pipeline steps that must be completed in order
- Dashboard shows tasks as rows, team members as columns, steps as cells

**Database Tables:**
- businesses (id, name, join_code)
- teams (id, business_id, name)
- members (id, business_id, name, email?, role)
- member_teams (member_id, team_id)
- tasks (id, team_id, title, description, deadline, status, created_by)
- pipeline_steps (id, task_id, step_order, name, assigned_to, is_joint, additional_assignees[], status)
- step_comments (id, step_id, member_id, content, attachments)
- notifications (id, member_id, type, title, content, is_read, is_addressed)
- announcements, shared_links, calendar_events (team content)
- ai_conversations (session_id, extracted_data, pending_question)
- email_settings (member_id, frequency)

**Key Features:**
1. Auth: Supabase auth, join via business code, role-based access
2. AI Flow: Multi-turn extraction with Groq, name matching to team members, confirmation step
3. Pipeline: Steps unlock sequentially, only assigned user can complete, notifications on unlock
4. Joint Tasks: "X or Y" pattern, claim/return mechanism
5. Dashboard Widgets: Announcements, shared links, visual calendar with color coding
6. Email Digests: Daily/weekly/monthly via Vercel Cron + Resend

**Pages:** /, /login, /reset-password, /select-business, /select-team, /dashboard, /add-log, /notifications, /admin

Read ~/BUILD_LOGS/taskpulse-v1.md for complete schema SQL, all API routes, and implementation details.

---

## 10. Supabase Storage

**Bucket:** `team-logos` (Public)
- Stores team logo images
- Files named `{team_id}.{ext}` (png, jpg, webp)
- Max 1MB per file
- Service role key used for uploads

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-01-21 | Initial release with full pipeline management, AI extraction, joint tasks, notifications, email digests, admin panel |
| v1.0.1 | 2026-01-22 | Added team logo upload, member archiving, recurring tasks, improved member deletion |
