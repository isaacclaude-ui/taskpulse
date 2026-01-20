import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { ExtractedTaskData } from '@/types';

// GET - Get a single task with steps
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const { data: steps } = await supabase
      .from('pipeline_steps')
      .select('*, member:members(*)')
      .eq('task_id', id)
      .order('step_order');

    return NextResponse.json({
      ...task,
      pipeline_steps: steps || [],
    });
  } catch (error: unknown) {
    console.error('Get task error:', error);
    return NextResponse.json(
      { error: 'Failed to get task' },
      { status: 500 }
    );
  }
}

// PATCH - Update task with AI-edited data
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { extractedData, memberAssignments } = await request.json() as {
      extractedData: ExtractedTaskData;
      memberAssignments: (string | null)[];
    };

    if (!extractedData) {
      return NextResponse.json(
        { error: 'Extracted data is required' },
        { status: 400 }
      );
    }

    // Get the task to find team_id and business_id
    const { data: task } = await supabase
      .from('tasks')
      .select('team_id')
      .eq('id', id)
      .single();

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const taskTeamId = task.team_id;

    // Get business_id from team
    const { data: team } = await supabase
      .from('teams')
      .select('business_id')
      .eq('id', taskTeamId)
      .single();

    const businessId = team?.business_id;

    // Helper function to get or create member
    async function getOrCreateMember(name: string): Promise<string | null> {
      if (!name || !businessId) return null;

      // Check if member exists
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('business_id', businessId)
        .ilike('name', name)
        .single();

      if (existingMember) {
        // Add to team if not already
        await supabase
          .from('member_teams')
          .upsert({ member_id: existingMember.id, team_id: taskTeamId }, { onConflict: 'member_id,team_id' });
        return existingMember.id;
      }

      // Create new member
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          name: name,
          email: null,
          role: 'user',
          business_id: businessId,
        })
        .select()
        .single();

      if (!memberError && newMember) {
        console.log('Auto-created member:', name, newMember.id);
        await supabase
          .from('member_teams')
          .insert({ member_id: newMember.id, team_id: taskTeamId });
        return newMember.id;
      }

      return null;
    }

    // Auto-create members for unmatched names (including joint assignments)
    const stepAssignments: (string | null)[] = [];
    const stepAdditionalAssignees: (string[] | null)[] = [];

    for (let i = 0; i < extractedData.pipeline_steps.length; i++) {
      const step = extractedData.pipeline_steps[i];
      const existingAssignment = memberAssignments?.[i];

      // If we already have a valid member ID, use it
      if (existingAssignment && existingAssignment !== 'null' && existingAssignment !== '') {
        stepAssignments.push(existingAssignment);
      } else {
        // Get or create primary assignee
        const assignedName = step.assigned_to_name;
        stepAssignments.push(assignedName ? await getOrCreateMember(assignedName) : null);
      }

      // Handle joint assignments (additional assignees)
      if (step.is_joint && step.additional_assignee_names && step.additional_assignee_names.length > 0) {
        const additionalIds: string[] = [];
        for (const altName of step.additional_assignee_names) {
          // Skip if same as primary
          if (altName === step.assigned_to_name) continue;
          const memberId = await getOrCreateMember(altName);
          if (memberId) additionalIds.push(memberId);
        }
        stepAdditionalAssignees.push(additionalIds.length > 0 ? additionalIds : null);
      } else {
        stepAdditionalAssignees.push(null);
      }
    }

    // Validate deadline format
    let taskDeadline = null;
    if (extractedData.deadline) {
      const parsed = new Date(extractedData.deadline);
      if (!isNaN(parsed.getTime())) {
        taskDeadline = parsed.toISOString().split('T')[0];
      }
    }

    // Update the task
    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        title: extractedData.title,
        description: extractedData.conclusion,
        conclusion: extractedData.conclusion,
        deadline: taskDeadline,
      })
      .eq('id', id);

    if (taskError) {
      console.error('Task update error:', taskError);
      return NextResponse.json(
        { error: `Failed to update task: ${taskError.message}` },
        { status: 500 }
      );
    }

    // Get existing steps to preserve completed ones
    const { data: existingSteps } = await supabase
      .from('pipeline_steps')
      .select('*')
      .eq('task_id', id)
      .order('step_order');

    // Build a map of completed steps (by order) to preserve their state
    const completedStepsByOrder = new Map<number, { id: string; completed_at: string | null }>();
    existingSteps?.forEach(step => {
      if (step.status === 'completed') {
        completedStepsByOrder.set(step.step_order, {
          id: step.id,
          completed_at: step.completed_at,
        });
      }
    });

    // Delete existing steps (we'll recreate them preserving completion status)
    await supabase
      .from('pipeline_steps')
      .delete()
      .eq('task_id', id);

    // Create new steps
    const newSteps = extractedData.pipeline_steps.map((step, index) => {
      const order = index + 1;
      const wasCompleted = completedStepsByOrder.get(order);
      const isCompleted = step.status === 'completed' || wasCompleted;

      // Validate mini_deadline
      let miniDeadline = null;
      if (step.mini_deadline) {
        const parsed = new Date(step.mini_deadline);
        if (!isNaN(parsed.getTime())) {
          miniDeadline = parsed.toISOString().split('T')[0];
        }
      }

      // Determine status: completed steps stay completed, first non-completed is unlocked
      let status: 'locked' | 'unlocked' | 'completed' = 'locked';
      if (isCompleted) {
        status = 'completed';
      } else {
        // Find if this is the first non-completed step
        const firstNonCompleted = extractedData.pipeline_steps.findIndex((s, i) => {
          const prevWasCompleted = completedStepsByOrder.get(i + 1);
          return s.status !== 'completed' && !prevWasCompleted;
        });
        if (firstNonCompleted === index) {
          status = 'unlocked';
        }
      }

      // Handle joint assignments
      const additionalAssignees = stepAdditionalAssignees[index] || [];
      const isJoint = step.is_joint && additionalAssignees.length > 0;

      return {
        task_id: id,
        step_order: order,
        name: step.name,
        assigned_to: stepAssignments[index] || null,
        assigned_to_name: step.assigned_to_name || null,
        additional_assignees: additionalAssignees,
        additional_assignee_names: step.additional_assignee_names || [],
        is_joint: isJoint,
        mini_deadline: miniDeadline,
        status,
        completed_at: isCompleted ? (wasCompleted?.completed_at || new Date().toISOString()) : null,
      };
    });

    const { error: stepsError } = await supabase
      .from('pipeline_steps')
      .insert(newSteps);

    if (stepsError) {
      console.error('Steps update error:', stepsError);
      return NextResponse.json(
        { error: `Failed to update steps: ${stepsError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Update task error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to update task: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// DELETE - Delete a task and its steps
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Steps will be cascade deleted by database constraint
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete task error:', error);
      return NextResponse.json(
        { error: `Failed to delete task: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete task error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
