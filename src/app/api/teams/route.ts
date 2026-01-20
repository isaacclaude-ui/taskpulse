import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const businessId = searchParams.get('businessId');

  try {
    let query = supabase.from('teams').select('*').order('name');

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: teams, error } = await query;

    if (error) throw error;

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('Get teams error:', error);
    return NextResponse.json({ error: 'Failed to get teams' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, businessId } = await request.json();

    if (!name || !businessId) {
      return NextResponse.json(
        { error: 'Name and business ID are required' },
        { status: 400 }
      );
    }

    const { data: team, error } = await supabase
      .from('teams')
      .insert({ name, business_id: businessId })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Create team error:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
