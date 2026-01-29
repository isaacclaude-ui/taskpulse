# TaskPulse BUILD_LOG v5.0

**One-liner:** Pipeline-based task management app where freeform notes become structured tasks on a team dashboard.

**Production URL:** https://taskpulse.vercel.app

**Stack:** Next.js 16 + React 19 + Supabase + Groq AI + Tailwind CSS 4 + Resend + Vercel

---

## What's New in v5.0

| Feature | Description |
|---------|-------------|
| **Team Isolation (1-Team Rule)** | Non-admins can only belong to 1 team - enforced at API level |
| **Team-Scoped AI Matching** | AI name matching only searches within the current team (no cross-team leakage) |
| **Unified Admin Tables** | Members & Notifications tabs use single-table structure with consistent column widths |
| **Tab URL Persistence** | Admin panel remembers active tab via `?tab=` URL param across page refresh |
| **Role-Based Sorting** | Leads appear above Staff within each team section |
| **Pipeline Header Wrapping** | Column headers wrap text instead of truncating long names |

---

## 1. Team Isolation - 1-Team Rule

Non-admin members (Lead, Staff) can only belong to one team. This ensures complete isolation between teams.

### API Enforcement (`/src/app/api/members/route.ts`)

```typescript
const memberRole = role || 'user';
const teamsToAdd = teamIds || (teamId ? [teamId] : []);

// Enforce 1-team rule for non-admins
if (memberRole !== 'admin' && teamsToAdd.length > 1) {
  return NextResponse.json(
    { error: 'Non-admin members can only belong to one team' },
    { status: 400 }
  );
}
```

### Team Update Enforcement (`/src/app/api/members/[id]/teams/route.ts`)

```typescript
// Enforce 1-team rule for non-admins
if (member.role !== 'admin' && teamIds && teamIds.length > 1) {
  return NextResponse.json(
    { error: 'Non-admin members can only belong to one team' },
    { status: 400 }
  );
}
```

---

## 2. Team-Scoped AI Member Matching (`/src/app/api/ai/confirm/route.ts`)

When AI extracts names from notes, it only matches within the current team. If "John" exists in Team A but the task is for Team B, a NEW member is created for Team B.

```typescript
// Helper function to get or create member (TEAM-SCOPED)
// Rule: Each team is isolated - only match members within this team
async function getOrCreateMember(name: string): Promise<string | null> {
  if (!name || !actualBusinessId) return null;

  // Get member IDs that belong to THIS team only
  const { data: teamMembers } = await supabase
    .from('member_teams')
    .select('member_id')
    .eq('team_id', teamId);

  const teamMemberIds = teamMembers?.map(tm => tm.member_id) || [];

  // Search for member by name ONLY within this team
  if (teamMemberIds.length > 0) {
    const { data: existingMember } = await supabase
      .from('members')
      .select('id')
      .in('id', teamMemberIds)
      .ilike('name', name)
      .single();

    if (existingMember) {
      return existingMember.id;
    }
  }

  // Not found in this team - create a NEW member for this team
  // (Even if same name exists in another team, they are different people)
  const { data: newMember, error: memberError } = await supabase
    .from('members')
    .insert({
      name: name,
      email: null,
      role: 'user',
      business_id: actualBusinessId,
    })
    .select()
    .single();

  if (!memberError && newMember) {
    await supabase
      .from('member_teams')
      .insert({ member_id: newMember.id, team_id: teamId });
    return newMember.id;
  }

  return null;
}
```

**Key principle:** Teams are completely siloed. Same name in different teams = different people.

---

## 3. Unified Admin Tables with Consistent Alignment (`/src/app/admin/page.tsx`)

Previous approach (multiple separate tables per section) caused column misalignment. New approach: single `<table>` with colored header rows for sections.

### Table Structure Pattern

```tsx
<table className="w-full table-fixed">
  {/* Single header row for all sections */}
  <thead>
    <tr className="border-b border-gray-200 bg-gray-100">
      <th className="w-[25%]">Name</th>
      <th className="w-[30%]">Email</th>
      <th className="w-[12%] hidden sm:table-cell">Role</th>
      <th className="w-[18%] hidden md:table-cell">Team</th>
      <th className="w-[15%]">Actions</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-gray-100">
    {/* Admins Section Header */}
    <tr className="bg-purple-50">
      <td colSpan={5} className="py-2 px-3">
        <div className="text-sm font-semibold text-purple-700">
          Admins ({count})
        </div>
      </td>
    </tr>
    {/* Admin rows... */}

    {/* Team Section Header */}
    <tr className="bg-gradient-to-r from-teal-50 to-emerald-50">
      <td colSpan={5} className="py-2 px-3">
        <div className="text-sm font-semibold text-teal-700">
          {team.name} ({count})
        </div>
      </td>
    </tr>
    {/* Team member rows... */}
  </tbody>
</table>
```

**Key:** `table-fixed` + percentage widths ensure consistent alignment. Section headers use `colSpan={5}`.

---

## 4. Tab URL Persistence (`/src/app/admin/page.tsx`)

Admin panel tab state persists in URL, surviving page refresh.

```typescript
import { useRouter, useSearchParams } from 'next/navigation';

// Get initial tab from URL or default
const searchParams = useSearchParams();
const tabFromUrl = searchParams.get('tab') as Tab | null;
const validTabs: Tab[] = ['settings', 'teams', 'members', 'pending', 'notifications', 'content'];
const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'settings';

const [activeTab, setActiveTab] = useState<Tab>(initialTab);

// Update URL when tab changes (without full page reload)
const handleTabChange = (tab: Tab) => {
  setActiveTab(tab);
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', tab);
  router.replace(`/admin?${params.toString()}`, { scroll: false });
};
```

**Usage:** `handleTabChange('members')` updates both state and URL to `/admin?tab=members`

---

## 5. Role-Based Sorting (Leads Above Staff)

Team members are sorted by role hierarchy, then alphabetically.

```typescript
// Group non-admin members by their team, sorted by role (leads first)
const membersByTeam: { [teamId: string]: typeof filteredMembers } = {};
teams.forEach(t => {
  membersByTeam[t.id] = filteredMembers
    .filter(m => m.role !== 'admin' && m.teamIds?.includes(t.id))
    .sort((a, b) => {
      // Leads first, then staff (user)
      if (a.role === 'lead' && b.role !== 'lead') return -1;
      if (a.role !== 'lead' && b.role === 'lead') return 1;
      return a.name.localeCompare(b.name); // Then alphabetically
    });
});
```

---

## 6. Pipeline Header Wrapping (`/src/components/PipelineGrid.tsx`)

Column headers wrap instead of truncating, showing full member names.

```tsx
{displayMembers.map((member) => (
  <th
    key={member.id}
    className="sticky top-0 z-20 bg-slate-200 border-b border-l border-slate-300 p-3 font-semibold text-slate-700 text-sm text-center align-top"
    style={{ width: `${MEMBER_COL_WIDTH}px`, minWidth: `${MEMBER_COL_WIDTH}px` }}
  >
    <div className="break-words leading-tight" title={member.name}>{member.name}</div>
  </th>
))}
```

**Key change:** Removed `truncate`, added `break-words leading-tight`, removed `maxWidth` constraint.

---

## Files Changed in v5.0

| File | Changes |
|------|---------|
| `src/app/admin/page.tsx` | Tab persistence, unified tables, leads sorting, React import |
| `src/app/api/members/route.ts` | 1-team rule enforcement on creation |
| `src/app/api/members/[id]/teams/route.ts` | 1-team rule enforcement on update |
| `src/app/api/ai/confirm/route.ts` | Team-scoped member matching |
| `src/components/PipelineGrid.tsx` | Header text wrapping |

---

## Rebuild Prompt

To recreate TaskPulse v5.0 from scratch:

```
Build a Next.js 16 pipeline task management app called TaskPulse with:

1. Supabase backend with tables: businesses, teams, members, member_teams, tasks, pipeline_steps, notifications, ai_conversations

2. AI-powered task creation: User pastes meeting notes → Groq AI extracts title, steps, assignees, deadlines → User confirms → Task created

3. Pipeline dashboard showing tasks as rows, team members as columns, with step cards in the intersection

4. Team isolation: Non-admins belong to exactly 1 team. AI member matching is team-scoped only.

5. Admin panel with tabs: Settings, Teams, Members, Pending, Notifications, Content
   - Tables grouped by category (Admins → Teams → Unassigned)
   - Tab state persists in URL via ?tab= param

6. Role hierarchy: Admin > Lead > Staff. Leads sorted above Staff in lists.

7. Vercel deployment with Resend for email notifications.

Use BUILD_LOG_V5.md for detailed implementation patterns.
```

---

## v5.1 Patch — Input Text Visibility Fix

**Issue:** All `.input-field` elements (AI chat textarea, admin forms, etc.) inherited text color from `body { color: var(--foreground) }`. On devices with dark mode, `--foreground` becomes `#ededed` (near-white), making text invisible on white inputs.

**Fix** (`/src/app/globals.css`):
```css
.input-field {
  color: #171717;
  background-color: #ffffff;
}
```

**Lesson:** Always set explicit `color` and `background-color` on form inputs. Never rely on CSS variable inheritance for elements with fixed backgrounds.

---

**Shipped:** v5.0 January 24, 2026 | v5.1 January 29, 2026
