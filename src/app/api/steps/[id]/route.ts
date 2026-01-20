import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get step with assigned member
    const { data: step, error: stepError } = await supabase
      .from('pipeline_steps')
      .select(`
        *,
        member:members!pipeline_steps_assigned_to_fkey (
          id, name, email
        )
      `)
      .eq('id', id)
      .single();

    if (stepError) throw stepError;

    // Get all steps in the same task to find prev/next
    const { data: allSteps } = await supabase
      .from('pipeline_steps')
      .select(`
        id, step_order, name, assigned_to_name,
        member:members!pipeline_steps_assigned_to_fkey (
          id, name
        )
      `)
      .eq('task_id', step.task_id)
      .order('step_order', { ascending: true });

    // Find previous and next steps
    const currentOrder = step.step_order;
    const prevStep = allSteps?.find(s => s.step_order === currentOrder - 1) || null;
    const nextStep = allSteps?.find(s => s.step_order === currentOrder + 1) || null;

    // Get comments with member info
    const { data: comments, error: commentsError } = await supabase
      .from('step_comments')
      .select(`
        *,
        member:members!step_comments_member_id_fkey (
          id, name, email
        )
      `)
      .eq('step_id', id)
      .order('created_at', { ascending: true });

    if (commentsError) throw commentsError;

    return NextResponse.json({ step, comments, prevStep, nextStep });
  } catch (error) {
    console.error('Get step error:', error);
    return NextResponse.json({ error: 'Failed to get step' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  try {
    const { data: step, error } = await supabase
      .from('pipeline_steps')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ step });
  } catch (error) {
    console.error('Update step error:', error);
    return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
  }
}
