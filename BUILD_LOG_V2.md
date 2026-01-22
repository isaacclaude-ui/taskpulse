# TaskPulse BUILD_LOG v2.0

**One-liner:** Pipeline-based task management app where freeform notes become structured tasks on a team dashboard.

**Production URL:** https://taskpulse-nu.vercel.app

**Stack:** Next.js 16 + React 19 + Supabase + Groq AI + Tailwind CSS 4 + Resend + Vercel

---

## What's New in v2.0

| Feature | Description |
|---------|-------------|
| **Intro Modal** | First-login onboarding + "?" button to reopen anytime |
| **Lead Role Enhancement** | Leads have team-scoped admin powers (members, pending) |
| **Staff Email Summaries** | Staff now receive email digests (not just admin/lead) |
| **Pending Badge** | Pulsing amber badge on Admin button when pending users exist |
| **Visual Improvements** | Better progress bar arrows, refined step card styling |
| **Loading Screen Delay** | 400ms delay prevents flicker on fast loads |

---

## 1. Database Schema

### Complete SQL (Run in Supabase SQL Editor)

```sql
-- TaskPulse Database Schema v2.0
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
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'lead', 'staff')),
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
  recurrence JSONB DEFAULT NULL,
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
  assigned_to_name TEXT,
  additional_assignees UUID[] DEFAULT '{}',
  additional_assignee_names TEXT[] DEFAULT '{}',
  is_joint BOOLEAN DEFAULT FALSE,
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
  requested_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
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
CREATE INDEX idx_member_teams_member ON member_teams(member_id);
CREATE INDEX idx_member_teams_team ON member_teams(team_id);
CREATE INDEX idx_tasks_team ON tasks(team_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_pipeline_steps_task ON pipeline_steps(task_id);
CREATE INDEX idx_pipeline_steps_assigned ON pipeline_steps(assigned_to);
CREATE INDEX idx_step_comments_step ON step_comments(step_id);
CREATE INDEX idx_notifications_member ON notifications(member_id);
CREATE INDEX idx_notifications_unread ON notifications(member_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_email_settings_member_id ON email_settings(member_id);
CREATE INDEX idx_announcements_team_id ON announcements(team_id);
CREATE INDEX idx_shared_links_team_id ON shared_links(team_id);
CREATE INDEX idx_calendar_events_team_id ON calendar_events(team_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
```

---

## 2. Environment Variables

```bash
# Supabase (Database + Auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

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

## 3. Key Components (v2 Additions)

### IntroModal (`/src/components/IntroModal.tsx`)

First-login onboarding modal that explains how Task Pulse works.

**Features:**
- Shows automatically on first visit (localStorage: `taskpulse-intro-seen`)
- Accessible anytime via "?" button in header
- Smooth fade/scale animations
- Themed to match app design (teal/emerald gradients)

**Usage in Dashboard:**
```tsx
import IntroModal from '@/components/IntroModal';

// State
const [showIntro, setShowIntro] = useState(false);

// First-login check
useEffect(() => {
  const hasSeenIntro = localStorage.getItem('taskpulse-intro-seen');
  if (!hasSeenIntro) {
    setShowIntro(true);
    localStorage.setItem('taskpulse-intro-seen', 'true');
  }
}, []);

// Info button in header
<button onClick={() => setShowIntro(true)} title="How it works">
  <svg>...</svg> {/* Question mark icon */}
</button>

// Modal
<IntroModal isOpen={showIntro} onClose={() => setShowIntro(false)} />
```

### Pending Badge Pattern

Pulsing amber badge on Admin/Team Admin button when pending users exist.

**Implementation:**
```tsx
// State
const [pendingCount, setPendingCount] = useState(0);

// Load count (admin sees all, lead sees team-scoped)
const loadPendingCount = async () => {
  if (member.role !== 'admin' && member.role !== 'lead') return;

  const url = member.role === 'lead' && teamId
    ? `/api/admin/pending-users?businessId=${business.id}&teamId=${teamId}`
    : `/api/admin/pending-users?businessId=${business.id}`;

  const res = await fetch(url);
  const data = await res.json();

  // Lead filters to their team only
  if (member.role === 'lead' && teamId) {
    const teamPending = data.pendingUsers.filter(p => p.requested_team_id === teamId);
    setPendingCount(teamPending.length);
  } else {
    setPendingCount(data.pendingUsers?.length || 0);
  }
};

// Badge UI
{pendingCount > 0 && (
  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold rounded-full px-1 animate-pulse">
    {pendingCount}
  </span>
)}
```

### LoadingScreen with Delay (`/src/components/LoadingScreen.tsx`)

Prevents flicker on fast page loads by delaying render.

```tsx
export default function LoadingScreen({ message = 'Loading', delay = 400 }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return null;
  // ... loading UI
}
```

---

## 4. Role-Based Access (v2 Enhanced)

| Feature | Admin | Lead | Staff |
|---------|-------|------|-------|
| View all teams | ✓ | Own team only | Own team only |
| Create tasks | ✓ | ✓ | ✓ |
| Complete any step | ✓ | Own team only | Assigned only |
| Access Admin Panel | ✓ Full | Members + Pending (team-scoped) | ✗ |
| Add/Edit members | ✓ All | Own team only | ✗ |
| Approve pending users | ✓ All | Own team only | ✗ |
| Manage teams | ✓ | ✗ | ✗ |
| Business settings | ✓ | ✗ | ✗ |
| Receive email summaries | ✓ | ✓ | ✓ |

**Lead Admin Panel Access:**
- Sees: Members tab, Pending tab, Notifications tab, Content tab
- Hidden: Settings tab, Teams tab
- All data filtered to their team only

---

## 5. API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/dashboard` | GET | Fetch tasks + steps for grid display |
| `/api/tasks/[id]` | PATCH, DELETE | Update or delete task |
| `/api/tasks/[id]/reopen` | POST | Reopen completed task |
| `/api/tasks/[id]/duplicate` | POST | Duplicate task with steps |
| `/api/steps/[id]` | GET, PATCH | View or update step details |
| `/api/steps/[id]/complete` | POST | Mark done + unlock next (admin/lead can complete any in their scope) |
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
| `/api/teams/[id]/logo` | POST, DELETE | Upload/remove team logo |
| `/api/members` | GET, POST | List/create members |
| `/api/members/[id]` | GET, PATCH, DELETE | View/update/delete member |
| `/api/members/[id]/teams` | GET | Get member's teams |
| `/api/notifications` | GET, PATCH | List/mark notifications |
| `/api/admin/pending-users` | GET, POST | Access request management (supports teamId filter) |
| `/api/admin/email-settings` | GET, POST | Email digest settings |
| `/api/send-summary` | POST | Send email summary to member |
| `/api/cron/send-emails` | GET | Scheduled email digest (includes staff role) |
| `/api/announcements` | GET, POST | Team announcements |
| `/api/announcements/[id]` | PATCH, DELETE | Update/delete announcement |
| `/api/shared-links` | GET, POST | Team shared links |
| `/api/shared-links/[id]` | PATCH, DELETE | Update/delete link |
| `/api/calendar-events` | GET, POST | Team calendar events |
| `/api/calendar-events/[id]` | PATCH, DELETE | Update/delete event |
| `/api/send-invite` | POST | Send invite email to member |
| `/api/upload` | POST | Upload attachments to Supabase Storage |

---

## 6. Page Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirect to dashboard or login |
| `/login` | Auth (signin/signup/request access with join code) |
| `/reset-password` | Password reset |
| `/select-business` | Choose business (multi-business support) |
| `/select-team` | Choose team within business |
| `/dashboard` | Main pipeline grid + announcements/links/calendar + intro modal |
| `/add-log` | AI-powered task creation flow |
| `/notifications` | View and manage notifications |
| `/admin` | Manage businesses, teams, members, content (role-scoped) |

---

## 7. Key UI Patterns

### Progress Bar with Integrated Arrow

```tsx
{/* Segmented progress bar */}
<div className="flex items-center gap-1 mb-2">
  {Array.from({ length: pipeline.total }).map((_, i) => {
    const isCompleted = i < pipeline.completed;
    const isCurrent = i === pipeline.completed;
    const isLast = i === pipeline.total - 1;
    return (
      <div key={i} className="flex-1 flex items-center">
        <div className={`h-2 flex-1 ${isLast ? 'rounded-l-full' : 'rounded-full'} ${
          isCompleted ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
            : isCurrent ? 'bg-gradient-to-r from-green-400 to-green-500 animate-pulse'
            : 'bg-slate-200'
        }`} />
        {/* Arrow tip on last segment */}
        {isLast && (
          <div className={`w-0 h-0 border-t-[5px] border-b-[5px] border-l-[6px] border-t-transparent border-b-transparent ${
            isCompleted ? 'border-l-emerald-500'
              : isCurrent ? 'border-l-green-500'
              : 'border-l-slate-200'
          }`} />
        )}
      </div>
    );
  })}
</div>
```

### Status Tags (Done/Next)

```tsx
{/* Pill-style tag at bottom-right of step card */}
{status === 'completed' && (
  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-gray-100 text-gray-500 text-[8px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wide">
    <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
    Done
  </div>
)}
```

---

## 8. External Services Setup

### Supabase
1. Create project at supabase.com
2. Run schema SQL in SQL Editor
3. Create Storage bucket `team-logos` (public)
4. Enable Email auth in Auth > Providers
5. Copy Project URL, Anon Key, and Service Role Key

### Groq
1. Sign up at console.groq.com
2. Create API key
3. Model: `llama-3.1-8b-instant`

### Resend
1. Sign up at resend.com
2. Verify domain or use test domain
3. Create API key

### Vercel
1. Connect GitHub repo
2. Add environment variables
3. Configure cron in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/send-emails",
    "schedule": "0 8 * * *"
  }]
}
```

---

## 9. Dependencies

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

## 10. Rebuild Prompt

Use this prompt to have another Claude rebuild TaskPulse v2:

---

**Prompt:**

Build TaskPulse v2 - a pipeline-based task management app where freeform notes become structured tasks.

**Stack:** Next.js 16, React 19, Supabase, Groq AI (llama-3.1-8b-instant), Tailwind CSS 4, Resend

**Core Concept:**
- User enters freeform note like "Maya writes blog by 15th, David creates graphics by 20th"
- AI extracts: title, steps with assignees, deadlines
- Creates task with pipeline steps that must be completed in order
- Dashboard shows tasks as rows, team members as columns, steps as cells

**v2 Key Features:**
1. Intro Modal - First-login onboarding + "?" button to reopen anytime
2. Lead Role Enhancement - Leads have team-scoped admin powers (members, pending)
3. Staff Email Summaries - All roles receive email digests
4. Pending Badge - Pulsing amber badge when pending users exist
5. Visual refinements - Progress bar arrows, step card styling, loading delay

**Database:** See BUILD_LOG_V2.md for complete schema

**Pages:** /, /login, /reset-password, /select-business, /select-team, /dashboard, /add-log, /notifications, /admin

Read ~/BUILD_LOGS/taskpulse-v2.md for complete schema SQL, all API routes, and implementation details.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-01-21 | Initial release |
| v1.1 | 2026-01-22 | Team logo, member archiving, recurring tasks |
| v2.0 | 2026-01-22 | Intro modal, lead role enhancement, staff emails, pending badge, visual improvements |
