import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { memberId } = await request.json();

  try {
    // Get the current step with task info
    const { data: currentStep, error: getError } = await supabase
      .from('pipeline_steps')
      .select('*, task:tasks(id, title, created_by)')
      .eq('id', id)
      .single();

    if (getError) throw getError;

    // Verify step is unlocked
    if (currentStep.status !== 'unlocked') {
      return NextResponse.json(
        { error: 'Step is not available for completion' },
        { status: 400 }
      );
    }

    // Check if member is admin and get their name
    const { data: member } = await supabase
      .from('members')
      .select('role, name')
      .eq('id', memberId)
      .single();

    const isAdmin = member?.role === 'admin';
    const completerName = member?.name || 'Someone';

    // For joint tasks, check if member is in additional_assignees
    const isJointAssignee = currentStep.is_joint &&
      currentStep.additional_assignees &&
      currentStep.additional_assignees.includes(memberId);

    // Verify member is assigned (if step has assignment) - admins and joint assignees can complete
    if (currentStep.assigned_to && currentStep.assigned_to !== memberId && !isAdmin && !isJointAssignee) {
      return NextResponse.json(
        { error: 'Only the assigned member can complete this step' },
        { status: 403 }
      );
    }

    // Mark step as completed
    const { error: updateError } = await supabase
      .from('pipeline_steps')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Find and unlock the next step
    const { data: nextStep, error: nextError } = await supabase
      .from('pipeline_steps')
      .select('*')
      .eq('task_id', currentStep.task_id)
      .eq('step_order', currentStep.step_order + 1)
      .single();

    if (!nextError && nextStep) {
      // Unlock the next step
      await supabase
        .from('pipeline_steps')
        .update({ status: 'unlocked' })
        .eq('id', nextStep.id);

      // Notify the next step assignee(s) that it's their turn
      const assigneesToNotify: string[] = [];
      if (nextStep.assigned_to && nextStep.assigned_to !== memberId) {
        assigneesToNotify.push(nextStep.assigned_to);
      }
      // Also notify additional assignees for joint tasks
      if (nextStep.is_joint && nextStep.additional_assignees) {
        nextStep.additional_assignees.forEach((id: string) => {
          if (id !== memberId && !assigneesToNotify.includes(id)) {
            assigneesToNotify.push(id);
          }
        });
      }

      // Create notifications
      if (assigneesToNotify.length > 0) {
        const notifications = assigneesToNotify.map(assigneeId => ({
          member_id: assigneeId,
          type: 'assignment',
          title: `Your turn: "${nextStep.name}"`,
          content: `${completerName} completed the previous step. "${currentStep.task?.title || 'Task'}" is now waiting for you.`,
          link_task_id: currentStep.task_id,
          link_step_id: nextStep.id,
          is_read: false,
          created_by: memberId,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    } else {
      // No more steps - mark task as completed
      await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', currentStep.task_id);

      // Notify the task creator that the task is complete
      if (currentStep.task?.created_by && currentStep.task.created_by !== memberId) {
        await supabase.from('notifications').insert({
          member_id: currentStep.task.created_by,
          type: 'assignment',
          title: `Task completed: "${currentStep.task?.title || 'Task'}"`,
          content: `${completerName} completed the final step. All steps are now done!`,
          link_task_id: currentStep.task_id,
          is_read: false,
          created_by: memberId,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Complete step error:', error);
    return NextResponse.json({ error: 'Failed to complete step' }, { status: 500 });
  }
}
