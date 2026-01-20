import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Get member's teams
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data: memberTeams, error } = await supabase
      .from('member_teams')
      .select('team_id, teams(id, name, business_id)')
      .eq('member_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const teams = memberTeams?.map(mt => mt.teams).filter(Boolean) || [];

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('Get member teams error:', error);
    return NextResponse.json({ error: 'Failed to get teams' }, { status: 500 });
  }
}

// PUT - Update member's team assignments (supports multiple teams)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { teamIds } = await request.json() as { teamIds: string[] };

    // Delete existing team assignments
    await supabase
      .from('member_teams')
      .delete()
      .eq('member_id', id);

    // Insert new team assignments
    if (teamIds && teamIds.length > 0) {
      const newAssignments = teamIds.map(teamId => ({
        member_id: id,
        team_id: teamId,
      }));

      const { error } = await supabase
        .from('member_teams')
        .insert(newAssignments);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update member teams error:', error);
    return NextResponse.json({ error: 'Failed to update teams' }, { status: 500 });
  }
}
