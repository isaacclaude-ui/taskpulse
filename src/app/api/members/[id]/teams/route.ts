import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Get member's teams
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Get member info to check role and business
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('role, business_id')
      .eq('id', id)
      .single();

    if (memberError) {
      console.error('Error fetching member:', memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // First try to get team IDs from member_teams
    const { data: memberTeams, error: mtError } = await supabase
      .from('member_teams')
      .select('team_id')
      .eq('member_id', id);

    if (mtError) {
      console.error('Error fetching member_teams:', mtError);
      return NextResponse.json({ error: mtError.message }, { status: 500 });
    }

    let teamIds = memberTeams?.map(mt => mt.team_id) || [];

    // If no member_teams entries but user is admin, get all teams in their business
    if (teamIds.length === 0 && member?.role === 'admin' && member?.business_id) {
      const { data: allTeams, error: allTeamsError } = await supabase
        .from('teams')
        .select('id, name, business_id')
        .eq('business_id', member.business_id);

      if (allTeamsError) {
        console.error('Error fetching all teams:', allTeamsError);
        return NextResponse.json({ error: allTeamsError.message }, { status: 500 });
      }

      return NextResponse.json({ teams: allTeams || [] });
    }

    if (teamIds.length === 0) {
      return NextResponse.json({ teams: [] });
    }

    // Fetch the actual team data
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, business_id')
      .in('id', teamIds);

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
      return NextResponse.json({ error: teamsError.message }, { status: 500 });
    }

    return NextResponse.json({ teams: teams || [] });
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
