import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Lazy initialization to avoid build-time env var issues
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 1MB.' },
        { status: 400 }
      );
    }

    // Get file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `${teamId}.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Delete existing logo if present (different extension)
    const { data: existingFiles } = await getSupabaseAdmin().storage
      .from('team-logos')
      .list('', { search: teamId });

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => f.name);
      await getSupabaseAdmin().storage.from('team-logos').remove(filesToDelete);
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await getSupabaseAdmin().storage
      .from('team-logos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = getSupabaseAdmin().storage
      .from('team-logos')
      .getPublicUrl(fileName);

    const logoUrl = urlData.publicUrl;

    // Update teams table with logo_url
    const { error: updateError } = await getSupabaseAdmin()
      .from('teams')
      .update({ logo_url: logoUrl })
      .eq('id', teamId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }

    return NextResponse.json({ logo_url: logoUrl });
  } catch (error) {
    console.error('Logo upload error:', error);
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;

  try {
    // Get current team to find logo filename
    const { data: team } = await getSupabaseAdmin()
      .from('teams')
      .select('logo_url')
      .eq('id', teamId)
      .single();

    if (team?.logo_url) {
      // Extract filename from URL
      const urlParts = team.logo_url.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      await getSupabaseAdmin().storage.from('team-logos').remove([fileName]);
    }

    // Update teams table to remove logo_url
    const { error: updateError } = await getSupabaseAdmin()
      .from('teams')
      .update({ logo_url: null })
      .eq('id', teamId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logo delete error:', error);
    return NextResponse.json({ error: 'Failed to delete logo' }, { status: 500 });
  }
}
