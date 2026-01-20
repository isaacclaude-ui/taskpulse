import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { processTaskChat, taskToFundamentalSheet, type FundamentalSheet } from '@/lib/groq';
import type { ExtractedTaskData, Member } from '@/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, teamId, taskId, currentData } = await request.json() as {
      messages: ChatMessage[];
      teamId: string;
      taskId: string;
      currentData: ExtractedTaskData;
    };

    if (!teamId || !taskId || !messages?.length) {
      return NextResponse.json(
        { error: 'Team ID, task ID, and messages are required' },
        { status: 400 }
      );
    }

    // Get team members for matching
    const { data: memberTeams } = await supabase
      .from('member_teams')
      .select('member_id')
      .eq('team_id', teamId);

    const memberIds = memberTeams?.map(mt => mt.member_id) || [];

    let teamMembers: Member[] = [];
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from('members')
        .select('*')
        .in('id', memberIds);
      teamMembers = members || [];
    }

    // Get current task data from database for context
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    const { data: steps } = await supabase
      .from('pipeline_steps')
      .select('*')
      .eq('task_id', taskId)
      .order('step_order');

    // Build FundamentalSheet from current data for AI context
    let existingSheet: FundamentalSheet | undefined;
    if (task && steps) {
      const memberMap = new Map(teamMembers.map(m => [m.id, m.name]));
      existingSheet = taskToFundamentalSheet(task, steps, memberMap);
    }

    // Process with AI
    const result = await processTaskChat(messages, teamMembers, existingSheet);

    return NextResponse.json({
      extracted_data: result.extracted_data,
      matched_members: result.matched_members,
      unmatched_names: result.unmatched_names,
      ai_message: result.ai_message,
      ready_to_save: result.ready_to_create,
      suggested_new_members: result.suggested_new_members,
      team_members: teamMembers,
    });
  } catch (error: unknown) {
    console.error('AI edit error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to process edit: ${errorMessage}` },
      { status: 500 }
    );
  }
}
