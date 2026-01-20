import { NextRequest, NextResponse } from 'next/server';
import { processTaskChat, ChatMessage } from '@/lib/groq';
import { supabase } from '@/lib/supabase';
import type { Member } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { messages, teamId } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Get team members for context
    const { data: memberTeams } = await supabase
      .from('member_teams')
      .select('member_id')
      .eq('team_id', teamId);

    let teamMembers: Member[] = [];
    if (memberTeams && memberTeams.length > 0) {
      const { data: members } = await supabase
        .from('members')
        .select('*')
        .in('id', memberTeams.map((mt) => mt.member_id));
      teamMembers = members || [];
    }

    // Process the chat
    const result = await processTaskChat(
      messages as ChatMessage[],
      teamMembers
    );

    return NextResponse.json({
      ...result,
      team_members: teamMembers, // Send back for reference
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
