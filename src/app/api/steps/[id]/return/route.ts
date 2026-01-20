import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST - Return step to previous person
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { memberId, reason } = await request.json();

  try {
    // Get current step
    const { data: currentStep, error: stepError } = await supabase
      .from('pipeline_steps')
      .select('*, task:tasks(id, title)')
      .eq('id', id)
      .single();

    if (stepError) throw stepError;

    // Can only return unlocked steps
    if (currentStep.status !== 'unlocked') {
      return NextResponse.json(
        { error: 'Can only return steps that are in progress' },
        { status: 400 }
      );
    }

    // Find previous step
    const { data: prevStep, error: prevError } = await supabase
      .from('pipeline_steps')
      .select('*')
      .eq('task_id', currentStep.task_id)
      .eq('step_order', currentStep.step_order - 1)
      .single();

    if (prevError || !prevStep) {
      return NextResponse.json(
        { error: 'No previous step to return to' },
        { status: 400 }
      );
    }

    // Lock current step
    await supabase
      .from('pipeline_steps')
      .update({ status: 'locked' })
      .eq('id', id);

    // Unlock previous step (set back to unlocked, clear completed_at)
    await supabase
      .from('pipeline_steps')
      .update({
        status: 'unlocked',
        completed_at: null
      })
      .eq('id', prevStep.id);

    // Add a comment explaining the return
    if (reason) {
      const { data: member } = await supabase
        .from('members')
        .select('name')
        .eq('id', memberId)
        .single();

      await supabase
        .from('step_comments')
        .insert({
          step_id: prevStep.id,
          member_id: memberId,
          content: `⚠️ Returned from step "${currentStep.name}": ${reason}`,
        });

      // Notify the previous step owner
      if (prevStep.assigned_to && prevStep.assigned_to !== memberId) {
        await supabase.from('notifications').insert({
          member_id: prevStep.assigned_to,
          type: 'assignment',
          title: `Step returned: ${currentStep.task?.title || 'Task'}`,
          content: `${member?.name || 'Someone'} returned "${currentStep.name}" - needs your attention`,
          link_task_id: currentStep.task_id,
          link_step_id: prevStep.id,
          created_by: memberId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Step returned to previous person',
      returnedTo: prevStep.assigned_to_name || 'previous step'
    });
  } catch (error) {
    console.error('Return step error:', error);
    return NextResponse.json({ error: 'Failed to return step' }, { status: 500 });
  }
}
