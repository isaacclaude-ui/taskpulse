import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST - Claim a joint step (assign it exclusively to the claiming member)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { memberId } = await request.json();

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID required' }, { status: 400 });
    }

    // Get the step
    const { data: step, error: stepError } = await supabase
      .from('pipeline_steps')
      .select('*, task:tasks(id, team_id)')
      .eq('id', id)
      .single();

    if (stepError || !step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    // Verify step is joint
    if (!step.is_joint) {
      return NextResponse.json({ error: 'This step is not a joint assignment' }, { status: 400 });
    }

    // Verify step is unlocked (can only claim active steps)
    if (step.status !== 'unlocked') {
      return NextResponse.json({ error: 'Can only claim unlocked steps' }, { status: 400 });
    }

    // Verify member is authorized to claim (either primary or in additional_assignees)
    const isAuthorized =
      step.assigned_to === memberId ||
      (step.additional_assignees && step.additional_assignees.includes(memberId));

    // Also check if member is admin (can claim any joint step)
    const { data: member } = await supabase
      .from('members')
      .select('role, name')
      .eq('id', memberId)
      .single();

    const isAdminOrLead = member?.role === 'admin' || member?.role === 'lead';

    if (!isAuthorized && !isAdminOrLead) {
      return NextResponse.json({ error: 'You are not authorized to claim this step' }, { status: 403 });
    }

    // Claim the step: set assigned_to to claimer, clear additional_assignees, set is_joint to false
    const { error: updateError } = await supabase
      .from('pipeline_steps')
      .update({
        assigned_to: memberId,
        assigned_to_name: member?.name || null,
        additional_assignees: [],
        additional_assignee_names: [],
        is_joint: false,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Claim step error:', updateError);
      return NextResponse.json({ error: 'Failed to claim step' }, { status: 500 });
    }

    // Create notification for other potential assignees that step was claimed
    if (step.additional_assignees && step.additional_assignees.length > 0) {
      const otherAssignees = [step.assigned_to, ...step.additional_assignees]
        .filter((id: string) => id && id !== memberId);

      if (otherAssignees.length > 0) {
        const notifications = otherAssignees.map((assigneeId: string) => ({
          member_id: assigneeId,
          type: 'assignment',
          title: `${member?.name || 'Someone'} claimed "${step.name}"`,
          content: 'This shared step has been claimed by another team member.',
          link_task_id: step.task?.id || null,
          link_step_id: step.id,
          is_read: false,
          created_by: memberId,
        }));

        await supabase.from('notifications').insert(notifications);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Claim step error:', error);
    return NextResponse.json({ error: 'Failed to claim step' }, { status: 500 });
  }
}
