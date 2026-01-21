import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/calendar-events?teamId=xxx&month=YYYY-MM - Get calendar events for a team/month
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const month = searchParams.get('month'); // Format: YYYY-MM

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    let query = supabase
      .from('calendar_events')
      .select(`
        id, team_id, event_date, title, color, created_by, created_at,
        member:members!calendar_events_created_by_fkey (id, name)
      `)
      .eq('team_id', teamId)
      .order('event_date', { ascending: true });

    // Filter by month if provided
    if (month) {
      const startDate = `${month}-01`;
      const [year, monthNum] = month.split('-').map(Number);
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${month}-${lastDay.toString().padStart(2, '0')}`;
      query = query.gte('event_date', startDate).lte('event_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch calendar events error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: data });
  } catch (error) {
    console.error('Calendar events GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}

// POST /api/calendar-events - Create a new calendar event
export async function POST(request: NextRequest) {
  try {
    const { teamId, eventDate, title, color, memberId } = await request.json();

    if (!teamId || !eventDate || !title || !memberId) {
      return NextResponse.json({ error: 'Team ID, event date, title, and member ID are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        team_id: teamId,
        event_date: eventDate,
        title,
        color: color || '#0d9488',
        created_by: memberId,
      })
      .select(`
        id, team_id, event_date, title, color, created_by, created_at,
        member:members!calendar_events_created_by_fkey (id, name)
      `)
      .single();

    if (error) {
      console.error('Create calendar event error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ event: data });
  } catch (error) {
    console.error('Calendar events POST error:', error);
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
  }
}
