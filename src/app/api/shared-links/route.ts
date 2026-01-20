import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/shared-links?teamId=xxx - Get shared links for a team
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('shared_links')
      .select(`
        id, team_id, title, description, url, created_by, created_at,
        member:members!shared_links_created_by_fkey (id, name)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch shared links error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ links: data });
  } catch (error) {
    console.error('Shared links GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch shared links' }, { status: 500 });
  }
}

// POST /api/shared-links - Create a new shared link
export async function POST(request: NextRequest) {
  try {
    const { teamId, title, description, url, memberId } = await request.json();

    if (!teamId || !title || !url || !memberId) {
      return NextResponse.json({ error: 'Team ID, title, URL, and member ID are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('shared_links')
      .insert({
        team_id: teamId,
        title,
        description: description || null,
        url,
        created_by: memberId,
      })
      .select(`
        id, team_id, title, description, url, created_by, created_at,
        member:members!shared_links_created_by_fkey (id, name)
      `)
      .single();

    if (error) {
      console.error('Create shared link error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ link: data });
  } catch (error) {
    console.error('Shared links POST error:', error);
    return NextResponse.json({ error: 'Failed to create shared link' }, { status: 500 });
  }
}
