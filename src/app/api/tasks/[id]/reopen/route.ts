import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST - Reopen a completed task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get the task to verify it's completed
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('status')
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    if (task.status !== 'completed') {
      return NextResponse.json({ error: 'Pipeline is not completed' }, { status: 400 });
    }

    // Get the last step (highest step_order)
    const { data: lastStep, error: stepError } = await supabase
      .from('pipeline_steps')
      .select('id, step_order')
      .eq('task_id', id)
      .order('step_order', { ascending: false })
      .limit(1)
      .single();

    if (stepError || !lastStep) {
      return NextResponse.json({ error: 'No steps found' }, { status: 400 });
    }

    // Update the last step back to 'unlocked' and clear completed_at
    const { error: updateStepError } = await supabase
      .from('pipeline_steps')
      .update({
        status: 'unlocked',
        completed_at: null,
      })
      .eq('id', lastStep.id);

    if (updateStepError) {
      throw updateStepError;
    }

    // Update the task back to 'active' and clear completed_at
    const { error: updateTaskError } = await supabase
      .from('tasks')
      .update({
        status: 'active',
        completed_at: null,
      })
      .eq('id', id);

    if (updateTaskError) {
      throw updateTaskError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reopen task error:', error);
    return NextResponse.json({ error: 'Failed to reopen pipeline' }, { status: 500 });
  }
}
