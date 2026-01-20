import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: comments, error } = await supabase
      .from('step_comments')
      .select(`
        *,
        member:members!step_comments_member_id_fkey (
          id, name, email
        )
      `)
      .eq('step_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json({ error: 'Failed to get comments' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { memberId, content, attachments } = await request.json();

  if (!memberId || !content) {
    return NextResponse.json(
      { error: 'Member ID and content are required' },
      { status: 400 }
    );
  }

  try {
    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from('step_comments')
      .insert({
        step_id: id,
        member_id: memberId,
        content,
        attachments: attachments || [],
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Parse @mentions (e.g., @Maya, @David)
    const mentionPattern = /@(\w+)/g;
    const mentions = [...content.matchAll(mentionPattern)].map(m => m[1]);

    if (mentions.length > 0) {
      // Get step info for the notification
      const { data: step } = await supabase
        .from('pipeline_steps')
        .select('task_id, name')
        .eq('id', id)
        .single();

      // Get task title
      const { data: task } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', step?.task_id)
        .single();

      // Get commenter's name
      const { data: commenter } = await supabase
        .from('members')
        .select('name')
        .eq('id', memberId)
        .single();

      // Find members by name (case-insensitive)
      for (const mentionName of mentions) {
        const { data: mentionedMembers } = await supabase
          .from('members')
          .select('id')
          .ilike('name', `%${mentionName}%`);

        // Create notification for each matched member (except commenter)
        if (mentionedMembers) {
          for (const mentioned of mentionedMembers) {
            if (mentioned.id !== memberId) {
              await supabase.from('notifications').insert({
                member_id: mentioned.id,
                type: 'mention',
                title: `${commenter?.name || 'Someone'} mentioned you in "${task?.title || 'a task'}"`,
                content: content.substring(0, 100),
                link_task_id: step?.task_id,
                link_step_id: id,
                is_read: false,
                created_by: memberId,
              });
            }
          }
        }
      }
    }

    // Get the comment with member info
    const { data: commentWithMember, error: getError } = await supabase
      .from('step_comments')
      .select(`
        *,
        member:members!step_comments_member_id_fkey (
          id, name, email
        )
      `)
      .eq('id', comment.id)
      .single();

    if (getError) throw getError;

    return NextResponse.json({ comment: commentWithMember });
  } catch (error) {
    console.error('Add comment error:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
