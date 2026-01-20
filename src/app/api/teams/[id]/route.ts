import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name } = await request.json();

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  try {
    const { data: team, error } = await supabase
      .from('teams')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Update team error:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check if team has tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('team_id', id)
      .limit(1);

    if (tasks && tasks.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete team with existing tasks. Delete the tasks first.' },
        { status: 400 }
      );
    }

    // Delete team memberships first
    await supabase
      .from('member_teams')
      .delete()
      .eq('team_id', id);

    // Delete the team
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete team error:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
