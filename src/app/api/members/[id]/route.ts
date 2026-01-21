import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PATCH - Update member (role, name, etc.)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const updates = await request.json();

    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

// DELETE - Remove member (blocked if has active task assignments)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Check if member has any active task assignments
    // Active = step is not completed AND task is not completed
    const { data: activeSteps } = await supabase
      .from('pipeline_steps')
      .select(`
        id,
        name,
        status,
        task:tasks!inner(id, title, status)
      `)
      .or(`assigned_to.eq.${id},additional_assignees.cs.{${id}}`)
      .neq('status', 'completed');

    // Filter to only tasks that are still active
    const activeAssignments = activeSteps?.filter(
      step => {
        const task = step.task as unknown as { status: string } | null;
        return task && task.status === 'active';
      }
    ) || [];

    if (activeAssignments.length > 0) {
      const taskTitles = [...new Set(activeAssignments.map(s => {
        const task = s.task as unknown as { title: string };
        return task.title;
      }))];
      return NextResponse.json({
        error: 'Cannot delete member with active task assignments',
        hasActiveAssignments: true,
        activeCount: activeAssignments.length,
        taskTitles: taskTitles.slice(0, 3), // Show first 3 task titles
        suggestion: 'Archive the member instead, or reassign their tasks first'
      }, { status: 400 });
    }

    // Safe to delete - no active assignments
    // First, unassign member from ALL pipeline steps (including completed ones)
    await supabase
      .from('pipeline_steps')
      .update({ assigned_to: null })
      .eq('assigned_to', id);

    // Remove from additional_assignees arrays (for joint tasks)
    const { data: stepsWithAdditional } = await supabase
      .from('pipeline_steps')
      .select('id, additional_assignees')
      .contains('additional_assignees', [id]);

    if (stepsWithAdditional && stepsWithAdditional.length > 0) {
      for (const step of stepsWithAdditional) {
        const updatedAssignees = (step.additional_assignees || []).filter(
          (assigneeId: string) => assigneeId !== id
        );
        await supabase
          .from('pipeline_steps')
          .update({ additional_assignees: updatedAssignees.length > 0 ? updatedAssignees : null })
          .eq('id', step.id);
      }
    }

    // Delete member_teams entries
    await supabase
      .from('member_teams')
      .delete()
      .eq('member_id', id);

    // Delete notifications for this member
    await supabase
      .from('notifications')
      .delete()
      .eq('member_id', id);

    // Delete step comments by this member
    await supabase
      .from('step_comments')
      .delete()
      .eq('member_id', id);

    // Delete the member
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete member error:', error);
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }
}
