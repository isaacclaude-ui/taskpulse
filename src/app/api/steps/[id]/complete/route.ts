import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { TaskRecurrence } from '@/types';

// Calculate next deadline based on recurrence pattern
function calculateNextDeadline(currentDeadline: string, recurrence: TaskRecurrence): string {
  const date = new Date(currentDeadline);

  switch (recurrence.type) {
    case 'daily':
      date.setDate(date.getDate() + recurrence.interval);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * recurrence.interval));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + recurrence.interval);
      break;
  }

  return date.toISOString().split('T')[0];
}

// Calculate step's mini deadline based on offset from original task deadline
function calculateStepDeadline(
  originalStepDeadline: string | null,
  originalTaskDeadline: string | null,
  newTaskDeadline: string
): string | null {
  if (!originalStepDeadline || !originalTaskDeadline) return null;

  const stepDate = new Date(originalStepDeadline);
  const taskDate = new Date(originalTaskDeadline);
  const newTaskDate = new Date(newTaskDeadline);

  // Calculate offset in days
  const offsetMs = stepDate.getTime() - taskDate.getTime();

  // Apply same offset to new task deadline
  const newStepDate = new Date(newTaskDate.getTime() + offsetMs);
  return newStepDate.toISOString().split('T')[0];
}

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
          content: `${completerName} completed "${currentStep.name}". Your step is now unlocked.`,
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

      // Check if this is a recurring task and create next cycle
      const { data: completedTask } = await supabase
        .from('tasks')
        .select('*, pipeline_steps:pipeline_steps(*)')
        .eq('id', currentStep.task_id)
        .single();

      if (completedTask?.recurrence?.enabled) {
        const recurrence = completedTask.recurrence as TaskRecurrence;

        // Calculate next deadline
        const currentDeadline = completedTask.deadline || new Date().toISOString().split('T')[0];
        const nextDeadline = calculateNextDeadline(currentDeadline, recurrence);

        // Create new task for next cycle
        const { data: newTask, error: newTaskError } = await supabase
          .from('tasks')
          .insert({
            team_id: completedTask.team_id,
            title: completedTask.title,
            description: completedTask.description,
            conclusion: completedTask.conclusion,
            actionables: completedTask.actionables,
            deadline: nextDeadline,
            status: 'active',
            created_by: completedTask.created_by,
            recurrence: completedTask.recurrence,
            source_task_id: completedTask.source_task_id || completedTask.id,
            recurrence_count: (completedTask.recurrence_count || 0) + 1,
          })
          .select()
          .single();

        if (!newTaskError && newTask) {
          // Clone pipeline steps with reset status
          const steps = completedTask.pipeline_steps || [];
          const newSteps = steps.map((step: { step_order: number; name: string; assigned_to: string | null; assigned_to_name: string | null; additional_assignees: string[] | null; additional_assignee_names: string[] | null; is_joint: boolean | null; mini_deadline: string | null }, index: number) => ({
            task_id: newTask.id,
            step_order: step.step_order,
            name: step.name,
            assigned_to: step.assigned_to,
            assigned_to_name: step.assigned_to_name,
            additional_assignees: step.additional_assignees || [],
            additional_assignee_names: step.additional_assignee_names || [],
            is_joint: step.is_joint || false,
            mini_deadline: calculateStepDeadline(step.mini_deadline, completedTask.deadline, nextDeadline),
            status: index === 0 ? 'unlocked' : 'locked',
          }));

          await supabase.from('pipeline_steps').insert(newSteps);

          // Notify first step assignee about the new cycle
          const firstStep = newSteps[0];
          if (firstStep?.assigned_to) {
            await supabase.from('notifications').insert({
              member_id: firstStep.assigned_to,
              type: 'assignment',
              title: `New cycle: "${newTask.title}"`,
              content: `Recurring task has started a new cycle (${newTask.recurrence_count + 1}). Your step "${firstStep.name}" is ready.`,
              link_task_id: newTask.id,
              is_read: false,
              created_by: completedTask.created_by,
            });
          }

          // Also notify additional assignees for joint first steps
          if (firstStep?.is_joint && firstStep?.additional_assignees) {
            const additionalNotifications = firstStep.additional_assignees
              .filter((id: string) => id !== firstStep.assigned_to)
              .map((assigneeId: string) => ({
                member_id: assigneeId,
                type: 'assignment',
                title: `New cycle: "${newTask.title}"`,
                content: `Recurring task has started a new cycle (${newTask.recurrence_count + 1}). Your shared step "${firstStep.name}" is ready.`,
                link_task_id: newTask.id,
                is_read: false,
                created_by: completedTask.created_by,
              }));

            if (additionalNotifications.length > 0) {
              await supabase.from('notifications').insert(additionalNotifications);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Complete step error:', error);
    return NextResponse.json({ error: 'Failed to complete step' }, { status: 500 });
  }
}
