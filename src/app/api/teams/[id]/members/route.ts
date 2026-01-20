import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: memberTeams, error: mtError } = await supabase
      .from('member_teams')
      .select('member_id')
      .eq('team_id', id);

    if (mtError) throw mtError;

    if (!memberTeams || memberTeams.length === 0) {
      return NextResponse.json({ members: [] });
    }

    const { data: members, error: mError } = await supabase
      .from('members')
      .select('*')
      .in('id', memberTeams.map((mt) => mt.member_id));

    if (mError) throw mError;

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Get team members error:', error);
    return NextResponse.json({ error: 'Failed to get members' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const { memberId } = await request.json();

  if (!memberId) {
    return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
  }

  try {
    const { error } = await supabase.from('member_teams').insert({
      team_id: teamId,
      member_id: memberId,
    });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Member already in team' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add member to team error:', error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const { memberId } = await request.json();

  if (!memberId) {
    return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('member_teams')
      .delete()
      .eq('team_id', teamId)
      .eq('member_id', memberId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove member from team error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
