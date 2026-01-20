import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // If ID provided, fetch single business
    if (id) {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return NextResponse.json({ business });
    }

    // Otherwise fetch all businesses
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .order('name');

    if (error) throw error;

    return NextResponse.json({ businesses });
  } catch (error) {
    console.error('Get businesses error:', error);
    return NextResponse.json({ error: 'Failed to get businesses' }, { status: 500 });
  }
}

// Generate a random 6-character alphanumeric code
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars like O/0, I/1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Generate unique join code
    const joinCode = generateJoinCode();

    const { data: business, error } = await supabase
      .from('businesses')
      .insert({ name, join_code: joinCode })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ business });
  } catch (error) {
    console.error('Create business error:', error);
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { businessId, name } = await request.json();

    if (!businessId || !name) {
      return NextResponse.json({ error: 'Business ID and name are required' }, { status: 400 });
    }

    const { data: business, error } = await supabase
      .from('businesses')
      .update({ name })
      .eq('id', businessId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ business });
  } catch (error) {
    console.error('Update business error:', error);
    return NextResponse.json({ error: 'Failed to update business' }, { status: 500 });
  }
}
