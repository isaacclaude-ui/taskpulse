import Groq from 'groq-sdk';
import type { ExtractedTaskData, Member } from '@/types';

// Initialize Groq client only if API key is available
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// Chat message type
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Extraction result with member matching
export interface SmartExtractionResult {
  extracted_data: ExtractedTaskData;
  matched_members: { step_index: number; member_id: string; member_name: string }[];
  unmatched_names: string[];
  ai_message: string;
  ready_to_create: boolean;
  suggested_new_members: string[];
}

// Build system prompt - AI only extracts data, we do member matching
function buildSystemPrompt(existingTask?: FundamentalSheet): string {
  const today = new Date();
  const year = today.getFullYear();

  const existingTaskContext = existingTask ? `
## CURRENT STATE (Fundamental Sheet to EDIT)
\`\`\`json
${JSON.stringify(existingTask, null, 2)}
\`\`\`

IMPORTANT RULES FOR EDITING:
1. COMPLETED steps are IMMUTABLE - never change them (historical record)
2. Only modify fields the user explicitly mentions
3. Preserve all other data exactly as-is
4. If user says someone "resigned" or "can't do it" - replace that person, don't delete the step
5. If user says someone "completed" - mark status as "completed"
` : '';

  return `You are an intelligent data assistant. Your job: extract task information into a FUNDAMENTAL SHEET.

TODAY: ${today.toISOString().split('T')[0]} (Year: ${year})
${existingTaskContext}
## THE FUNDAMENTAL SHEET

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| title | YES | string | Short task name |
| steps[].what | YES | string | Action description |
| steps[].who | NO | string | EXACT person name from user's text |
| steps[].who_alternatives | NO | string[] | For "X or Y" - list ALL names |
| steps[].is_joint | NO | boolean | True if multiple people can do step |
| steps[].by_when | NO | YYYY-MM-DD | Deadline for this step |
| steps[].status | AUTO | pending/completed | Track progress |
| overall_deadline | NO | YYYY-MM-DD | Usually last step's date |

## INTELLIGENCE RULES

1. **EXTRACT NAMES EXACTLY as written:**
   "Maya writes blog by 15th, David creates graphics by 20th"
   → steps: [{what:"blog", who:"Maya", by_when:"${year}-01-15"}, {what:"graphics", who:"David", by_when:"${year}-01-20"}]

   "Lisa does blog" → who:"Lisa" (NOT null, NOT "Admin User")

2. **JOINT ASSIGNMENTS - "X or Y" patterns:**
   When user says "X or Y can do..." or "either X or Y..." or "X/Y does..."
   → Set is_joint: true, who: first name, who_alternatives: [all names]

   Examples:
   "George or Ethan can do step 3" → {what:"Step 3", who:"George", who_alternatives:["George","Ethan"], is_joint:true}
   "Maya/David reviews" → {what:"Review", who:"Maya", who_alternatives:["Maya","David"], is_joint:true}
   "either Lisa or Tom approves" → {what:"Approve", who:"Lisa", who_alternatives:["Lisa","Tom"], is_joint:true}

3. **UNDERSTAND context:**
   - "Lisa finished" → mark Lisa's step as completed
   - "John resigned, Isaac takes over" → replace John with Isaac (don't delete step)
   - "push deadline to 25th" → update by_when for relevant step

4. **PRESERVE data:**
   - Completed steps = IMMUTABLE (historical record)
   - Only change what user explicitly mentions
   - Keep everything else intact

5. **DATES:** Always YYYY-MM-DD. "Feb 5th" → "${year}-02-05"

## RESPONSE FORMAT (JSON)
{
  "title": "Task title",
  "summary": "Brief workflow description (max 150 chars) explaining what happens: who does what, in what order",
  "steps": [
    {"what": "Action", "who": "Person name or null", "who_alternatives": ["Name1", "Name2"] or null, "is_joint": true/false, "by_when": "YYYY-MM-DD or null", "status": "pending"}
  ],
  "overall_deadline": "YYYY-MM-DD or null",
  "ai_message": "Brief response to user",
  "ready_to_create": true/false
}

## SUMMARY FIELD
Generate a concise workflow description (max 150 chars). Example:
"Maya writes the blog post, David creates supporting graphics, then Lisa schedules and publishes everything."

## ready_to_create
- TRUE: User confirms ("yes", "ok", "looks good", "create it") OR all info clearly provided
- FALSE: First message (need review) OR critical info missing

CRITICAL FORMATTING RULES:
1. **Title Case for titles:** "product launch campaign" → "Product Launch Campaign"
2. **Sentence case for steps:** "writes blog" → "Write Blog Post"
3. **Title Case for names:** "maya" → "Maya", "david" → "David"
4. **Steps are numbered:** Step 1, Step 2, Step 3... (order matters for workflow)

Example input: "maya writes blog, david does graphics"
Output:
- title: "Blog and Graphics Project"
- steps[0]: {what: "Write Blog Post", who: "Maya"}
- steps[1]: {what: "Create Graphics", who: "David"}`;
}

// Fundamental Sheet type - the source of truth
export interface FundamentalSheet {
  task_id?: string;
  title: string;
  steps: {
    step_id?: string;
    order: number;
    what: string;
    who: string | null;
    who_id: string | null;
    by_when: string | null;
    status: 'pending' | 'completed';
    completed_at?: string;
  }[];
  overall_deadline: string | null;
}

// Convert database task to FundamentalSheet for AI editing
export function taskToFundamentalSheet(task: { id: string; title: string; deadline?: string }, steps: { id: string; step_order: number; name: string; assigned_to?: string; mini_deadline?: string; status: string; completed_at?: string }[], memberMap: Map<string, string>): FundamentalSheet {
  return {
    task_id: task.id,
    title: task.title,
    steps: steps.map(s => ({
      step_id: s.id,
      order: s.step_order,
      what: s.name,
      who: s.assigned_to ? (memberMap.get(s.assigned_to) || null) : null,
      who_id: s.assigned_to || null,
      by_when: s.mini_deadline || null,
      status: s.status === 'completed' ? 'completed' : 'pending',
      completed_at: s.completed_at,
    })),
    overall_deadline: task.deadline || null,
  };
}

// Match extracted names to team members (case-insensitive)
function matchNameToMember(name: string | null, teamMembers: Member[]): Member | null {
  if (!name) return null;
  const lowerName = name.toLowerCase().trim();
  return teamMembers.find(m =>
    m.name.toLowerCase().trim() === lowerName ||
    m.name.toLowerCase().includes(lowerName) ||
    lowerName.includes(m.name.toLowerCase())
  ) || null;
}

// Process a chat message in the task creation flow
export async function processTaskChat(
  messages: ChatMessage[],
  teamMembers: Member[],
  existingTask?: FundamentalSheet
): Promise<SmartExtractionResult> {
  if (!groq) {
    throw new Error('Groq API key not configured');
  }

  // AI only extracts data - no member matching in prompt
  const systemPrompt = buildSystemPrompt(existingTask);

  const response = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
    model: 'llama-3.1-8b-instant',
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  console.log('AI Response:', content);

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {
      title: 'Untitled Task',
      steps: [],
      ai_message: "I had trouble understanding that. Could you describe the task again?",
      ready_to_create: false,
    };
  }

  // Handle both old format (pipeline_steps) and new format (steps)
  const rawSteps = parsed.steps || parsed.pipeline_steps || [];

  // Extract deadline from last step if not explicitly set
  const lastStepDeadline = rawSteps.length > 0
    ? (rawSteps[rawSteps.length - 1]?.by_when || rawSteps[rawSteps.length - 1]?.mini_deadline)
    : null;
  const taskDeadline = parsed.overall_deadline || parsed.deadline || lastStepDeadline;

  // Normalize steps and do our own member matching
  const matchedMembers: { step_index: number; member_id: string; member_name: string }[] = [];
  const unmatchedNames: string[] = [];

  const normalizedSteps = rawSteps.map((s: { what?: string; name?: string; who?: string; assigned_to_name?: string; who_alternatives?: string[]; is_joint?: boolean; by_when?: string; mini_deadline?: string; status?: string }, index: number) => {
    const extractedName = s.who || s.assigned_to_name || null;
    const isJoint = s.is_joint || false;
    const alternatives = s.who_alternatives || [];

    // WE do the matching, not the AI
    if (extractedName) {
      const matchedMember = matchNameToMember(extractedName, teamMembers);
      if (matchedMember) {
        matchedMembers.push({
          step_index: index,
          member_id: matchedMember.id,
          member_name: matchedMember.name,
        });
      } else {
        // Name not in team - will be auto-created on confirm
        if (!unmatchedNames.includes(extractedName)) {
          unmatchedNames.push(extractedName);
        }
      }
    }

    // Also check alternatives for unmatched names
    if (isJoint && alternatives.length > 0) {
      alternatives.forEach(altName => {
        if (altName && altName !== extractedName) {
          const matched = matchNameToMember(altName, teamMembers);
          if (!matched && !unmatchedNames.includes(altName)) {
            unmatchedNames.push(altName);
          }
        }
      });
    }

    return {
      name: s.what || s.name || 'Untitled Step',
      assigned_to_name: extractedName,  // Keep the raw extracted name
      additional_assignee_names: isJoint ? alternatives : undefined,
      is_joint: isJoint || undefined,
      mini_deadline: s.by_when || s.mini_deadline || null,
      status: s.status || 'pending',
    };
  });

  console.log('Extracted names from AI:', normalizedSteps.map((s: { assigned_to_name: string | null; is_joint?: boolean; additional_assignee_names?: string[] }) =>
    s.is_joint ? `${s.assigned_to_name} (joint: ${s.additional_assignee_names?.join(', ')})` : s.assigned_to_name
  ));
  console.log('Matched to team members:', matchedMembers);
  console.log('Unmatched names (will be auto-created):', unmatchedNames);

  return {
    extracted_data: {
      title: parsed.title || 'Untitled Task',
      summary: parsed.summary || null, // AI-generated workflow description
      conclusion: parsed.conclusion,
      actionables: parsed.actionables || [],
      deadline: taskDeadline,
      pipeline_steps: normalizedSteps,
      confidence: parsed.ready_to_create ? 'high' : 'medium',
    },
    matched_members: matchedMembers,
    unmatched_names: unmatchedNames,
    ai_message: parsed.ai_message || "I've extracted the task. Does this look correct?",
    ready_to_create: parsed.ready_to_create || false,
    suggested_new_members: unmatchedNames,
  };
}

// Quick extraction for initial parse (backwards compatible)
export async function extractTaskFromNote(
  input: string,
  teamMembers: Member[] = []
): Promise<SmartExtractionResult> {
  return processTaskChat(
    [{ role: 'user', content: input }],
    teamMembers
  );
}
