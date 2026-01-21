import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the original task
    const { data: originalTask, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (taskError || !originalTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get the original steps
    const { data: originalSteps, error: stepsError } = await supabase
      .from('pipeline_steps')
      .select('*')
      .eq('task_id', id)
      .order('step_order', { ascending: true });

    if (stepsError) {
      return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 });
    }

    // Create the duplicate task
    const { data: newTask, error: newTaskError } = await supabase
      .from('tasks')
      .insert({
        team_id: originalTask.team_id,
        title: `Copy of ${originalTask.title}`,
        description: originalTask.description,
        status: 'active',
        deadline: null, // Clear deadline for the copy
        recurrence: originalTask.recurrence,
        recurrence_count: 0,
        created_by: originalTask.created_by,
      })
      .select()
      .single();

    if (newTaskError || !newTask) {
      return NextResponse.json({ error: 'Failed to create duplicate task' }, { status: 500 });
    }

    // Create duplicate steps with reset statuses
    if (originalSteps && originalSteps.length > 0) {
      const newSteps = originalSteps.map((step, index) => ({
        task_id: newTask.id,
        name: step.name,
        step_order: step.step_order,
        assigned_to: step.assigned_to,
        status: index === 0 ? 'unlocked' : 'locked', // First step unlocked, rest locked
        mini_deadline: null, // Clear mini deadlines
        is_joint: step.is_joint,
        additional_assignees: step.additional_assignees,
      }));

      const { error: newStepsError } = await supabase
        .from('pipeline_steps')
        .insert(newSteps);

      if (newStepsError) {
        // Rollback: delete the task if steps failed
        await supabase.from('tasks').delete().eq('id', newTask.id);
        return NextResponse.json({ error: 'Failed to create duplicate steps' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      task: newTask,
      message: 'Pipeline duplicated successfully'
    });

  } catch (error) {
    console.error('Duplicate task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
