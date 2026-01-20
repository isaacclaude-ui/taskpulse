import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch notifications for a member
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const memberId = searchParams.get('memberId');
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const filter = searchParams.get('filter'); // 'inbox' | 'archived' | 'all'
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!memberId) {
    return NextResponse.json({ error: 'Member ID required' }, { status: 400 });
  }

  try {
    let query = supabase
      .from('notifications')
      .select(`
        *,
        task:tasks!notifications_link_task_id_fkey (id, title),
        step:pipeline_steps!notifications_link_step_id_fkey (id, name),
        creator:members!notifications_created_by_fkey (id, name)
      `)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by addressed status
    if (filter === 'inbox') {
      query = query.eq('is_addressed', false);
    } else if (filter === 'archived') {
      query = query.eq('is_addressed', true);
    }

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    // Count unread (only in inbox)
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('is_read', false)
      .eq('is_addressed', false);

    // Count inbox items
    const { count: inboxCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('is_addressed', false);

    return NextResponse.json({
      notifications,
      unreadCount: unreadCount || 0,
      inboxCount: inboxCount || 0
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Failed to get notifications' }, { status: 500 });
  }
}

// PATCH - Mark notification(s) as read or addressed
export async function PATCH(request: NextRequest) {
  try {
    const { notificationId, memberId, markAllRead, markAddressed, unmarkAddressed } = await request.json();

    if (markAllRead && memberId) {
      // Mark all as read for this member (only in inbox)
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('member_id', memberId)
        .eq('is_read', false)
        .eq('is_addressed', false);

      if (error) throw error;
    } else if (markAddressed && notificationId) {
      // Mark notification as addressed (archive it)
      const { error } = await supabase
        .from('notifications')
        .update({ is_addressed: true, is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } else if (unmarkAddressed && notificationId) {
      // Move back to inbox
      const { error } = await supabase
        .from('notifications')
        .update({ is_addressed: false })
        .eq('id', notificationId);

      if (error) throw error;
    } else if (notificationId) {
      // Mark single notification as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
