# TaskPulse BUILD_LOG v1.1

**One-liner:** Pipeline-based task management app with continuous comment flow, file attachments, and calendar integration.

**Production URL:** https://task-pulse.vercel.app

**Stack:** Next.js 16 + React 19 + Supabase + Groq AI + Tailwind CSS 4 + Resend + Vercel

**Previous Version:** v1.0 (see BUILD_LOG_V1.md for base setup)

---

## What's New in v1.1

### 1. Continuous Comment Flow (Pipeline Notes)
Comments now flow across ALL steps in the same pipeline, creating a continuous conversation thread.

**Changes:**
- `src/app/api/steps/[id]/route.ts` - Fetches comments from all steps in task
- `src/components/StepDetailModal.tsx` - Displays comments with step context
- `src/types/index.ts` - Extended `StepCommentWithMember` to include step info

**How it works:**
- When viewing any step, you see ALL comments from ALL steps in that pipeline
- Each comment shows which step it was made on (Step 1: Design, Step 2: Review, etc.)
- Comments from current step highlighted in teal

### 2. File Attachments
Users can now attach files to comments.

**New Files:**
- `src/app/api/upload/route.ts` - Handles file uploads to Supabase Storage

**Requirements:**
- Create Supabase Storage bucket: `comment-attachments` (public)
- Max file size: 5MB
- Allowed types: images, PDF, Word, Excel, text files

**Database:** Already supports attachments via `step_comments.attachments` JSONB column

### 3. Color Scheme Update
Consistent color coding across the app.

| Status | Cell Color | Card Color | Legend |
|--------|------------|------------|--------|
| Now (active) | Green-50 + green border | Green-50 | Green dot |
| Coming Soon | White (faded) | Blue-50 | Blue dot |
| Done | Grey-100 + grey border (faded) | Grey-100 | Grey dot |

**Files changed:**
- `src/components/PersonCell.tsx` - Cell and card styling
- `src/components/PipelineGrid.tsx` - Legend colors
- `src/components/DashboardSummary.tsx` - Scorecard colors

### 4. Calendar Auto-Deadlines
Task and step deadlines automatically appear in the calendar.

**Features:**
- Pipeline deadlines: Red dots, format `Due: [Pipeline Name]`
- Step deadlines: Faded red dots, format `Due: [Pipeline] - [Step]`
- Manual events still show as before (truncated titles)
- Sort order: Manual events → Step deadlines → Pipeline deadlines

**Character limits:**
- Task name: 30 chars
- Step name: 25 chars

**File:** `src/app/dashboard/page.tsx`

### 5. Subtle Micro-Interactions
All buttons now have smooth hover/press animations.

**Effects:**
- Hover: Scale up 2-3%, color deepens
- Press: Scale down to 95-97%
- Transition: 150ms ease-out

**Files:**
- `src/app/globals.css` - Added `.clickable` utility, updated btn-primary/secondary
- `src/components/PersonCell.tsx` - Done/Return buttons

### 6. UI Refinements
- **Done/Return buttons:** "Done" (green) and "Return" (grey), compact sizing
- **Active cards:** Same height as other cards, green tint draws attention
- **Non-active cells:** Faded opacity (60% for done, 50% for pending)

---

## Files Changed in v1.1

| File | Changes |
|------|---------|
| `src/app/api/steps/[id]/route.ts` | Fetch all comments across pipeline |
| `src/app/api/upload/route.ts` | NEW - File upload endpoint |
| `src/app/dashboard/page.tsx` | Calendar auto-deadlines, truncation |
| `src/app/globals.css` | Micro-interactions, button styles |
| `src/components/PersonCell.tsx` | Color scheme, compact buttons |
| `src/components/PipelineGrid.tsx` | Legend color update |
| `src/components/DashboardSummary.tsx` | Scorecard colors (green for active) |
| `src/components/StepDetailModal.tsx` | Pipeline Notes UI, attachments |
| `src/types/index.ts` | Extended StepCommentWithMember |

---

## Supabase Storage Setup (Required for v1.1)

Create bucket for comment attachments:

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `comment-attachments`
4. Set as **Public**

---

## Environment Variables

Same as v1.0, plus ensure `SUPABASE_SERVICE_ROLE_KEY` is set for file uploads.

---

## Deployment

```bash
# Tag version
git tag -a v1.1 -m "Version 1.1 - Pipeline Notes, Attachments, Calendar"
git push origin v1.1
```

---

## Upgrade from v1.0

1. Pull latest code
2. Create `comment-attachments` storage bucket in Supabase
3. Deploy to Vercel
4. No database migrations required (attachments column already exists)
