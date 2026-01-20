import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const businessId = searchParams.get('businessId');
  const includeTeams = searchParams.get('includeTeams') === 'true';

  try {
    let query = supabase.from('members').select('*').order('name');

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: members, error } = await query;

    if (error) throw error;

    // If includeTeams, fetch team assignments
    if (includeTeams && members && members.length > 0) {
      const memberIds = members.map(m => m.id);
      const { data: memberTeams } = await supabase
        .from('member_teams')
        .select('member_id, team_id')
        .in('member_id', memberIds);

      // Map team IDs to each member
      const membersWithTeams = members.map(m => ({
        ...m,
        teamIds: memberTeams?.filter(mt => mt.member_id === m.id).map(mt => mt.team_id) || [],
      }));

      return NextResponse.json({ members: membersWithTeams });
    }

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Get members error:', error);
    return NextResponse.json({ error: 'Failed to get members' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, role, businessId, teamId, teamIds } = await request.json();

    if (!name || !businessId) {
      return NextResponse.json(
        { error: 'Name and business ID are required' },
        { status: 400 }
      );
    }

    // Email is optional - members can exist without login
    const { data: member, error } = await supabase
      .from('members')
      .insert({
        name,
        email: email ? email.toLowerCase() : null,
        role: role || 'user',
        business_id: businessId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
      throw error;
    }

    // Add to team(s) if specified
    const teamsToAdd = teamIds || (teamId ? [teamId] : []);
    if (teamsToAdd.length > 0 && member) {
      const teamAssignments = teamsToAdd.map((tid: string) => ({
        member_id: member.id,
        team_id: tid,
      }));

      await supabase.from('member_teams').insert(teamAssignments);
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Create member error:', error);
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}
