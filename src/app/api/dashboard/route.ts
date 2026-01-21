import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { TaskWithSteps, Member } from '@/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const teamId = searchParams.get('teamId');
  const memberId = searchParams.get('memberId');
  const role = searchParams.get('role');
  const businessId = searchParams.get('businessId');
  const status = searchParams.get('status') || 'active';

  if (!teamId && role !== 'admin') {
    return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
  }

  try {
    let tasksQuery = supabase
      .from('tasks')
      .select(`
        *,
        pipeline_steps (
          *,
          member:members!pipeline_steps_assigned_to_fkey (
            id, name, email
          )
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    // Role-based filtering - always filter by selected team
    if (teamId) {
      // All roles see tasks in the selected team
      tasksQuery = tasksQuery.eq('team_id', teamId);
    } else if (role === 'admin' && businessId) {
      // Admin with no team selected sees all tasks in their business
      const { data: teamIds } = await supabase
        .from('teams')
        .select('id')
        .eq('business_id', businessId);

      if (teamIds && teamIds.length > 0) {
        tasksQuery = tasksQuery.in('team_id', teamIds.map(t => t.id));
      }
    }

    const { data: tasks, error: tasksError } = await tasksQuery;

    if (tasksError) {
      throw tasksError;
    }

    // Filter for regular users - only show tasks with assigned steps (including joint assignments)
    let filteredTasks = tasks || [];
    if (role === 'user' && memberId) {
      filteredTasks = filteredTasks.filter((task) =>
        task.pipeline_steps.some(
          (step: { assigned_to: string | null; additional_assignees?: string[] }) =>
            step.assigned_to === memberId ||
            (step.additional_assignees && step.additional_assignees.includes(memberId))
        )
      );
    }

    // Sort pipeline_steps by step_order
    filteredTasks = filteredTasks.map((task) => ({
      ...task,
      pipeline_steps: task.pipeline_steps.sort(
        (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
      ),
    }));

    // Get team members for header (exclude archived members)
    let membersQuery = supabase
      .from('members')
      .select('id, name, email, is_archived')
      .or('is_archived.is.null,is_archived.eq.false'); // Only active members

    if (teamId) {
      const { data: memberTeams } = await supabase
        .from('member_teams')
        .select('member_id')
        .eq('team_id', teamId);

      if (memberTeams && memberTeams.length > 0) {
        membersQuery = membersQuery.in('id', memberTeams.map(mt => mt.member_id));
      }
    }

    const { data: members, error: membersError } = await membersQuery;

    if (membersError) {
      throw membersError;
    }

    return NextResponse.json({
      tasks: filteredTasks as TaskWithSteps[],
      members: members as Member[],
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
