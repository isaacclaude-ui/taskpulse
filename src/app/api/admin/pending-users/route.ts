import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const businessId = searchParams.get('businessId');

  try {
    let query = supabase
      .from('pending_users')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: pendingUsers, error } = await query;

    if (error) throw error;

    return NextResponse.json({ pendingUsers });
  } catch (error) {
    console.error('Get pending users error:', error);
    return NextResponse.json({ error: 'Failed to get pending users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pendingUserId, action, name, role, teamIds } = await request.json();

    if (!pendingUserId || !action) {
      return NextResponse.json(
        { error: 'Pending user ID and action are required' },
        { status: 400 }
      );
    }

    // Get the pending user
    const { data: pendingUser, error: getError } = await supabase
      .from('pending_users')
      .select('*')
      .eq('id', pendingUserId)
      .single();

    if (getError || !pendingUser) {
      return NextResponse.json({ error: 'Pending user not found' }, { status: 404 });
    }

    if (action === 'approve') {
      if (!name || !pendingUser.business_id) {
        return NextResponse.json(
          { error: 'Name and business are required for approval' },
          { status: 400 }
        );
      }

      // Create the member
      const { data: member, error: memberError } = await supabase
        .from('members')
        .insert({
          name,
          email: pendingUser.email,
          role: role || 'user',
          business_id: pendingUser.business_id,
        })
        .select()
        .single();

      if (memberError) throw memberError;

      // Add to teams if specified
      if (teamIds && teamIds.length > 0) {
        const memberTeams = teamIds.map((teamId: string) => ({
          member_id: member.id,
          team_id: teamId,
        }));

        await supabase.from('member_teams').insert(memberTeams);
      }

      // Update pending user status
      await supabase
        .from('pending_users')
        .update({ status: 'approved' })
        .eq('id', pendingUserId);

      return NextResponse.json({ success: true, member });
    } else if (action === 'reject') {
      await supabase
        .from('pending_users')
        .update({ status: 'rejected' })
        .eq('id', pendingUserId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Process pending user error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
