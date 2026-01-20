import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/announcements?teamId=xxx - Get announcements for a team
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('announcements')
      .select(`
        id, team_id, content, created_by, created_at, updated_at,
        member:members!announcements_created_by_fkey (id, name)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Fetch announcements error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ announcements: data });
  } catch (error) {
    console.error('Announcements GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
  }
}

// POST /api/announcements - Create a new announcement
export async function POST(request: NextRequest) {
  try {
    const { teamId, content, memberId } = await request.json();

    if (!teamId || !content || !memberId) {
      return NextResponse.json({ error: 'Team ID, content, and member ID are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        team_id: teamId,
        content,
        created_by: memberId,
      })
      .select(`
        id, team_id, content, created_by, created_at, updated_at,
        member:members!announcements_created_by_fkey (id, name)
      `)
      .single();

    if (error) {
      console.error('Create announcement error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ announcement: data });
  } catch (error) {
    console.error('Announcements POST error:', error);
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}
