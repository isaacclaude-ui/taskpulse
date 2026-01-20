import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const validFrequencies = ['daily', 'weekly', 'monthly', 'none'];

// GET - Fetch email settings for a member or all members in a business
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const memberId = searchParams.get('memberId');
  const businessId = searchParams.get('businessId');

  try {
    if (memberId) {
      // Get settings for specific member
      const { data: settings, error } = await supabase
        .from('email_settings')
        .select('*')
        .eq('member_id', memberId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      return NextResponse.json({ settings: settings || null });
    }

    if (businessId) {
      // Get all members with email (who can receive emails) and their settings
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select(`
          id,
          name,
          email,
          role,
          email_settings (
            id,
            frequency,
            last_sent_at
          )
        `)
        .eq('business_id', businessId)
        .not('email', 'is', null); // All members with email can receive digests

      if (membersError) throw membersError;

      // Get team assignments for each member
      const memberIds = members?.map(m => m.id) || [];
      const { data: memberTeams } = await supabase
        .from('member_teams')
        .select('member_id, team_id, teams(name)')
        .in('member_id', memberIds);

      // Map teams to members
      const membersWithTeams = members?.map(m => ({
        ...m,
        teams: memberTeams?.filter(mt => mt.member_id === m.id).map(mt => mt.teams) || [],
        email_settings: Array.isArray(m.email_settings) ? m.email_settings[0] : m.email_settings,
      }));

      return NextResponse.json({ members: membersWithTeams });
    }

    return NextResponse.json({ error: 'Member ID or Business ID required' }, { status: 400 });
  } catch (error) {
    console.error('Get email settings error:', error);
    return NextResponse.json({ error: 'Failed to get email settings' }, { status: 500 });
  }
}

// POST - Create or update email settings
export async function POST(request: NextRequest) {
  try {
    const { memberId, frequency } = await request.json();

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    if (frequency && !validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be daily, weekly, monthly, or none' },
        { status: 400 }
      );
    }

    // Upsert settings
    const { data: settings, error } = await supabase
      .from('email_settings')
      .upsert(
        {
          member_id: memberId,
          frequency: frequency || 'weekly',
        },
        { onConflict: 'member_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Update email settings error:', error);
    return NextResponse.json({ error: 'Failed to update email settings' }, { status: 500 });
  }
}
