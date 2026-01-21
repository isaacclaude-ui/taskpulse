import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { ExtractedTaskData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { sessionId, teamId, createdBy, extractedData, memberAssignments, businessId } = body;

    
    if (!teamId || !extractedData) {
      return NextResponse.json(
        { error: 'Team ID and extracted data are required' },
        { status: 400 }
      );
    }

    const data = extractedData as ExtractedTaskData;

    if (!data.pipeline_steps || data.pipeline_steps.length === 0) {
      return NextResponse.json(
        { error: 'No pipeline steps found in extracted data' },
        { status: 400 }
      );
    }

    
    // Get business_id from team if not provided
    let actualBusinessId = businessId;
    if (!actualBusinessId) {
      const { data: team } = await supabase
        .from('teams')
        .select('business_id')
        .eq('id', teamId)
        .single();
      actualBusinessId = team?.business_id;
    }

    // Helper function to get or create member
    async function getOrCreateMember(name: string): Promise<string | null> {
      if (!name || !actualBusinessId) return null;

      // Check if member exists
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('business_id', actualBusinessId)
        .ilike('name', name)
        .single();

      if (existingMember) {
        // Add to team if not already
        await supabase
          .from('member_teams')
          .upsert({ member_id: existingMember.id, team_id: teamId }, { onConflict: 'member_id,team_id' });
        return existingMember.id;
      }

      // Create new member
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          name: name,
          email: null,
          role: 'user',
          business_id: actualBusinessId,
        })
        .select()
        .single();

      if (!memberError && newMember) {
        await supabase
          .from('member_teams')
          .insert({ member_id: newMember.id, team_id: teamId });
        return newMember.id;
      }

      console.error('Failed to create member:', name, memberError);
      return null;
    }

    // Auto-create members for unmatched names (including joint assignments)
    const stepAssignments: (string | null)[] = [];
    const stepAdditionalAssignees: (string[] | null)[] = [];

    for (let i = 0; i < data.pipeline_steps.length; i++) {
      const step = data.pipeline_steps[i];
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

    // Validate and format deadline
    let taskDeadline = null;
    if (data.deadline) {
      const parsed = new Date(data.deadline);
      if (!isNaN(parsed.getTime())) {
        taskDeadline = parsed.toISOString().split('T')[0];
      }
    }

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        team_id: teamId,
        title: data.title,
        description: data.summary || data.conclusion, // AI-generated workflow summary
        conclusion: data.conclusion,
        actionables: data.actionables || [],
        deadline: taskDeadline,
        status: 'active',
        created_by: createdBy || null,
        // Recurrence fields
        recurrence: data.recurrence || null,
        source_task_id: null,
        recurrence_count: 0,
      })
      .select()
      .single();

    if (taskError) {
      console.error('Task creation error:', taskError);
      return NextResponse.json(
        { error: `Failed to create task: ${taskError.message}` },
        { status: 500 }
      );
    }

    // Create pipeline steps
    let steps;
    try {
      steps = data.pipeline_steps.map((step, index) => {
        // Validate and format mini_deadline
        let miniDeadline = null;
        if (step.mini_deadline) {
          const parsed = new Date(step.mini_deadline);
          if (!isNaN(parsed.getTime())) {
            miniDeadline = parsed.toISOString().split('T')[0];
          }
        }

        // Use the pre-computed step assignments (with auto-created members)
        const assignedTo = stepAssignments[index] || null;
        const additionalAssignees = stepAdditionalAssignees[index] || [];
        const isJoint = step.is_joint && additionalAssignees.length > 0;

        return {
          task_id: task.id,
          step_order: index + 1,
          name: step.name || 'Untitled Step',
          assigned_to: assignedTo,
          assigned_to_name: step.assigned_to_name || null, // Preserve original name from AI
          additional_assignees: additionalAssignees,
          additional_assignee_names: step.additional_assignee_names || [],
          is_joint: isJoint,
          mini_deadline: miniDeadline,
          status: index === 0 ? 'unlocked' : 'locked', // First step is unlocked
        };
      });
    } catch (mapError) {
      console.error('Error mapping steps:', mapError);
      return NextResponse.json(
        { error: `Failed to process steps: ${mapError instanceof Error ? mapError.message : 'Unknown mapping error'}` },
        { status: 500 }
      );
    }

        const { error: stepsError } = await supabase
      .from('pipeline_steps')
      .insert(steps);

    if (stepsError) {
      console.error('Steps creation error:', stepsError);
      return NextResponse.json(
        { error: `Failed to create steps: ${stepsError.message}` },
        { status: 500 }
      );
    }
    
    // Get creator name for notifications
    let creatorName = 'Someone';
    if (createdBy) {
      const { data: creator } = await supabase
        .from('members')
        .select('name')
        .eq('id', createdBy)
        .single();
      creatorName = creator?.name || 'Someone';
    }

    // Notify assignees about their new assignments
    const notificationsToSend: { member_id: string; type: string; title: string; content: string; link_task_id: string; link_step_id?: string; is_read: boolean; created_by: string | null }[] = [];

    steps.forEach((step, index) => {
      const isFirstStep = index === 0;

      // Notify primary assignee
      if (step.assigned_to && step.assigned_to !== createdBy) {
        notificationsToSend.push({
          member_id: step.assigned_to,
          type: 'assignment',
          title: isFirstStep
            ? `New task: "${data.title}" - Your turn!`
            : `Assigned to step in "${data.title}"`,
          content: isFirstStep
            ? `${creatorName} created a new task. Step "${step.name}" is ready for you.`
            : `${creatorName} assigned you to step ${index + 1}: "${step.name}"`,
          link_task_id: task.id,
          is_read: false,
          created_by: createdBy || null,
        });
      }

      // Notify additional assignees for joint tasks
      if (step.is_joint && step.additional_assignees) {
        step.additional_assignees.forEach((assigneeId: string) => {
          if (assigneeId !== createdBy && assigneeId !== step.assigned_to) {
            notificationsToSend.push({
              member_id: assigneeId,
              type: 'assignment',
              title: isFirstStep
                ? `New task: "${data.title}" - Your turn!`
                : `Assigned to step in "${data.title}"`,
              content: isFirstStep
                ? `${creatorName} created a new task. Step "${step.name}" is shared with you.`
                : `${creatorName} assigned you to step ${index + 1}: "${step.name}" (shared)`,
              link_task_id: task.id,
              is_read: false,
              created_by: createdBy || null,
            });
          }
        });
      }
    });

    // Send all notifications
    if (notificationsToSend.length > 0) {
      await supabase.from('notifications').insert(notificationsToSend);
    }

    // Link conversation to task (audit trail) instead of deleting
    if (sessionId) {
      await supabase
        .from('ai_conversations')
        .update({
          task_id: task.id,
          status: 'confirmed',
          extracted_data: data, // Store final extraction state
        })
        .eq('session_id', sessionId);
    }

        return NextResponse.json({ success: true, taskId: task.id });
  } catch (error: unknown) {
    console.error('AI confirm error:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);

    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }

    return NextResponse.json(
      { error: `Failed to create task: ${errorMessage}` },
      { status: 500 }
    );
  }
}
