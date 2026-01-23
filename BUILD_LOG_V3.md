# TaskPulse BUILD_LOG v3.0

**One-liner:** Pipeline-based task management app where freeform notes become structured tasks on a team dashboard.

**Production URL:** https://taskpulse.vercel.app

**Stack:** Next.js 16 + React 19 + Supabase + Groq AI + Tailwind CSS 4 + Resend + Vercel

---

## What's New in v3.0

| Feature | Description |
|---------|-------------|
| **Joint Task UI** | Visual indication when step has multiple assignees, with separate dropdowns for each |
| **Improved Name Parsing** | AI correctly handles "X or Y", "X and Y", "X/Y", "both X and Y" patterns |
| **Duplicate Name Fix** | Primary assignee no longer appears in additional assignees list |

---

## 1. Joint Task Feature (v3 Addition)

### Database Schema (Already in v2)

The schema already supports joint tasks:

```sql
-- In pipeline_steps table
additional_assignees UUID[] DEFAULT '{}',
additional_assignee_names TEXT[] DEFAULT '{}',
is_joint BOOLEAN DEFAULT FALSE,
```

### AI Parsing Logic (`/src/lib/groq.ts`)

The key fix: ALWAYS parse combined name patterns before filtering.

```typescript
let extractedName = s.who || s.assigned_to_name || null;
let isJoint = s.is_joint || false;
let alternatives = s.who_alternatives || [];

// ALWAYS parse "X or Y" / "X and Y" / "X/Y" patterns from extractedName
// This runs regardless of whether alternatives already exist, because AI might return:
//   who: "Isaac or Lucy" (combined) + who_alternatives: ["Isaac", "Lucy"]
// We need to extract the true primary name ("Isaac") before filtering
if (extractedName) {
  const orMatch = extractedName.match(/^(.+?)\s+or\s+(.+)$/i);
  const andMatch = extractedName.match(/^(?:both\s+)?(.+?)\s+and\s+(.+)$/i);
  const slashMatch = extractedName.match(/^(.+?)\/(.+)$/);

  const match = orMatch || andMatch || slashMatch;
  if (match) {
    const name1 = match[1].trim();
    const name2 = match[2].trim();
    extractedName = name1; // Primary assignee is first name (now properly extracted)

    // Only populate alternatives if empty (AI didn't provide them)
    if (alternatives.length === 0) {
      alternatives = [name2];
    }
    isJoint = true;
  }
}

// Filter out the primary name from alternatives
// Now extractedName is the TRUE primary (e.g., "Isaac" not "Isaac or Lucy")
if (extractedName && alternatives.length > 0) {
  const primaryLower = extractedName.toLowerCase();
  alternatives = alternatives.filter(alt => alt.toLowerCase() !== primaryLower);
  isJoint = alternatives.length > 0;
}
```

### Joint Task UI (`/src/app/add-log/page.tsx`)

The ConfirmedAssignment interface now includes joint task fields:

```typescript
interface ConfirmedAssignment {
  memberId: string | null;
  memberName: string | null;
  extractedName: string | null;
  isJoint?: boolean;
  additionalMemberIds?: (string | null)[];
  additionalMemberNames?: (string | null)[];
  additionalExtractedNames?: string[];
}
```

When initializing assignments from AI extraction:

```typescript
// Handle joint assignments
const additionalNames = step.additional_assignee_names || [];
const isJoint = step.is_joint && additionalNames.length > 0;

return {
  memberId: matchedMember?.id || null,
  memberName: matchedMember?.name || null,
  extractedName: step.assigned_to_name || null,
  isJoint: isJoint,
  additionalMemberIds: additionalNames.map(() => null), // User confirms via dropdown
  additionalMemberNames: additionalNames.map(() => null),
  additionalExtractedNames: additionalNames,
};
```

UI rendering for additional assignees:

```tsx
{assignment.isJoint && assignment.additionalExtractedNames && assignment.additionalExtractedNames.length > 0 && (
  <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
    <div className="text-xs text-slate-500 font-medium">
      Joint task — also assigned:
    </div>
    {assignment.additionalExtractedNames.map((altName, altIndex) => (
      <div key={altIndex} className="flex items-center gap-2">
        <span className="text-xs text-slate-400 shrink-0">
          AI found: &quot;{altName}&quot;
        </span>
        <select
          value={assignment.additionalMemberIds?.[altIndex] || ''}
          onChange={(e) => handleAdditionalAssignmentChange(stepIndex, altIndex, e.target.value)}
          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md"
        >
          <option value="">Select member...</option>
          {teamMembers.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
    ))}
  </div>
)}
```

### API Handling (`/src/app/api/ai/confirm/route.ts`)

The confirm route handles both legacy string format and new object format:

```typescript
// Handle new assignment structure: { memberId, isJoint, additionalMemberIds }
// Also support legacy string format for backward compatibility
const assignmentObj = typeof existingAssignment === 'object' && existingAssignment !== null
  ? existingAssignment
  : { memberId: existingAssignment, isJoint: false, additionalMemberIds: [] };
```

---

## 2. Files Changed in v3

| File | Change |
|------|--------|
| `src/lib/groq.ts` | Fixed pattern parsing to always run, extract true primary name |
| `src/app/add-log/page.tsx` | Added joint task UI with additional assignee dropdowns |
| `src/components/TaskEditModal.tsx` | Added joint task UI for edit flow |
| `src/app/api/ai/confirm/route.ts` | Handle new assignment structure with additionalMemberIds |
| `src/app/api/tasks/[id]/route.ts` | Handle joint assignments in PATCH |

---

## 3. Complete Database Schema

(Same as v2 - see BUILD_LOG_V2.md)

---

## 4. Environment Variables

(Same as v2 - see BUILD_LOG_V2.md)

---

## 5. API Routes

(Same as v2, plus joint task handling in existing routes)

---

## 6. Rebuild Prompt

Use this prompt to have another Claude rebuild TaskPulse v3:

---

**Prompt:**

Build TaskPulse v3 - a pipeline-based task management app where freeform notes become structured tasks.

**Stack:** Next.js 16, React 19, Supabase, Groq AI (llama-3.1-8b-instant), Tailwind CSS 4, Resend

**Core Concept:**
- User enters freeform note like "Isaac or Lucy buy ingredients by Friday"
- AI extracts: title, steps with assignees (including joint assignments), deadlines
- Creates task with pipeline steps that must be completed in order
- Dashboard shows tasks as rows, team members as columns, steps as cells

**v3 Key Features:**
1. Joint Task UI - Visual indication and separate dropdowns for multiple assignees
2. Improved Name Parsing - Handles "X or Y", "X and Y", "X/Y", "both X and Y"
3. Duplicate Fix - Primary name correctly filtered from alternatives

**Critical Implementation Detail:**
When parsing AI output, ALWAYS extract the true primary name from combined patterns ("Isaac or Lucy" → "Isaac") BEFORE filtering the alternatives array. The AI may return both a combined `who` field and a populated `who_alternatives` array.

Read ~/BUILD_LOGS/taskpulse-v2.md for complete schema SQL, all API routes, and base implementation details.
Read ~/BUILD_LOGS/taskpulse-v3.md for joint task specific implementation.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-01-21 | Initial release |
| v1.1 | 2026-01-22 | Team logo, member archiving, recurring tasks |
| v2.0 | 2026-01-22 | Intro modal, lead role enhancement, staff emails, pending badge |
| v3.0 | 2026-01-23 | Joint task UI, improved name parsing, duplicate fix |
