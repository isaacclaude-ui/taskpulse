import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PATCH /api/shared-links/[id] - Update a shared link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title, description, url } = await request.json();

    const updateData: { title?: string; description?: string; url?: string } = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (url) updateData.url = url;

    const { data, error } = await supabase
      .from('shared_links')
      .update(updateData)
      .eq('id', id)
      .select(`
        id, team_id, title, description, url, created_by, created_at,
        member:members!shared_links_created_by_fkey (id, name)
      `)
      .single();

    if (error) {
      console.error('Update shared link error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ link: data });
  } catch (error) {
    console.error('Shared link PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update shared link' }, { status: 500 });
  }
}

// DELETE /api/shared-links/[id] - Delete a shared link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('shared_links')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete shared link error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Shared link DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete shared link' }, { status: 500 });
  }
}
