import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/send-summary - Send a dashboard summary email to a team lead/admin
export async function POST(request: NextRequest) {
  try {
    const { memberId } = await request.json();

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Get member info
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, name, email, role, business_id')
      .eq('id', memberId)
      .single();

    if (memberError || !member || !member.email) {
      return NextResponse.json({ error: 'Member not found or has no email' }, { status: 400 });
    }

    // Get business name
    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', member.business_id)
      .single();

    const businessName = business?.name || 'Your Business';

    // Get teams for this member (or all teams if admin)
    let teamIds: string[] = [];

    if (member.role === 'admin') {
      // Admin sees all teams in business
      const { data: allTeams } = await supabase
        .from('teams')
        .select('id, name')
        .eq('business_id', member.business_id);
      teamIds = allTeams?.map(t => t.id) || [];
    } else {
      // Lead sees their assigned teams
      const { data: memberTeams } = await supabase
        .from('member_teams')
        .select('team_id')
        .eq('member_id', memberId);
      teamIds = memberTeams?.map(mt => mt.team_id) || [];
    }

    if (teamIds.length === 0) {
      return NextResponse.json({ error: 'No teams assigned' }, { status: 400 });
    }

    // Get active tasks with steps
    const { data: activeTasks } = await supabase
      .from('tasks')
      .select(`
        id, title, deadline, status, created_at,
        pipeline_steps (
          id, name, status, assigned_to, step_order,
          member:members!pipeline_steps_assigned_to_fkey (name)
        ),
        team:teams (name)
      `)
      .in('team_id', teamIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    // Get recently completed tasks (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: completedTasks } = await supabase
      .from('tasks')
      .select(`
        id, title, completed_at,
        team:teams (name)
      `)
      .in('team_id', teamIds)
      .eq('status', 'completed')
      .gte('completed_at', weekAgo.toISOString())
      .order('completed_at', { ascending: false });

    // Calculate stats
    const totalActive = activeTasks?.length || 0;
    const totalCompleted = completedTasks?.length || 0;

    // Find steps waiting (unlocked)
    const waitingSteps: { taskTitle: string; stepName: string; assignee: string; teamName: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeTasks?.forEach((task: any) => {
      const sortedSteps = task.pipeline_steps?.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order) || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sortedSteps.forEach((step: any) => {
        if (step.status === 'unlocked') {
          waitingSteps.push({
            taskTitle: task.title,
            stepName: step.name,
            assignee: step.member?.name || 'Unassigned',
            teamName: task.team?.name || '',
          });
        }
      });
    });

    // Generate email HTML
    const emailHtml = generateEmailHtml({
      memberName: member.name,
      businessName,
      totalActive,
      totalCompleted,
      waitingSteps,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      completedTasks: (completedTasks || []) as any[],
      memberEmail: member.email,
    });

    // Send email using Resend
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured - email not sent');
      return NextResponse.json({
        success: true,
        message: 'Email would be sent (RESEND_API_KEY not configured)',
        preview: emailHtml,
      });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Task Pulse <onboarding@resend.dev>',
        to: member.email,
        subject: `Task Pulse Summary - ${businessName}`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('Resend error:', errorData);
      return NextResponse.json(
        { error: errorData?.message || 'Failed to send email', details: errorData },
        { status: 500 }
      );
    }

    // Update last_sent_at in email_settings
    await supabase
      .from('email_settings')
      .upsert(
        {
          member_id: memberId,
          last_sent_at: new Date().toISOString(),
        },
        { onConflict: 'member_id' }
      );

    return NextResponse.json({
      success: true,
      message: `Email sent to ${member.email}`,
    });

  } catch (error) {
    console.error('Send summary error:', error);
    return NextResponse.json({ error: 'Failed to send summary' }, { status: 500 });
  }
}

// Generate email HTML
function generateEmailHtml({
  memberName,
  businessName,
  totalActive,
  totalCompleted,
  waitingSteps,
  completedTasks,
  memberEmail,
}: {
  memberName: string;
  businessName: string;
  totalActive: number;
  totalCompleted: number;
  waitingSteps: { taskTitle: string; stepName: string; assignee: string; teamName: string }[];
  completedTasks: { title: string; completed_at: string; team?: { name: string } }[];
  memberEmail: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://taskpulse-nu.vercel.app';

  const waitingStepsHtml = waitingSteps.length > 0
    ? waitingSteps.slice(0, 10).map(step => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 500; color: #1e293b;">${step.stepName}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Task: ${step.taskTitle}</div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">
          <span style="display: inline-block; padding: 4px 10px; background-color: #fef3c7; color: #92400e; border-radius: 12px; font-size: 13px; font-weight: 500;">
            ${step.assignee}
          </span>
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="2" style="padding: 20px; text-align: center; color: #64748b;">No steps waiting</td></tr>`;

  const completedTasksHtml = completedTasks.length > 0
    ? completedTasks.slice(0, 5).map(task => `
      <div style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 500; color: #1e293b;">${task.title}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 2px;">
          ${task.team?.name || ''} • Completed ${new Date(task.completed_at).toLocaleDateString()}
        </div>
      </div>
    `).join('')
    : `<div style="padding: 20px; text-align: center; color: #64748b;">No tasks completed this week</div>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: white;">Task Pulse Summary</h1>
          <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Hi ${memberName}, here's your dashboard overview</p>
          <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">${businessName}</p>
        </div>

        <!-- Stats Cards -->
        <div style="display: flex; gap: 16px; margin-bottom: 24px;">
          <div style="flex: 1; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-size: 32px; font-weight: bold; color: #14b8a6;">${totalActive}</div>
            <div style="font-size: 14px; color: #64748b; margin-top: 4px;">Active Tasks</div>
          </div>
          <div style="flex: 1; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-size: 32px; font-weight: bold; color: #22c55e;">${totalCompleted}</div>
            <div style="font-size: 14px; color: #64748b; margin-top: 4px;">Completed This Week</div>
          </div>
          <div style="flex: 1; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">${waitingSteps.length}</div>
            <div style="font-size: 14px; color: #64748b; margin-top: 4px;">Steps Waiting</div>
          </div>
        </div>

        <!-- Waiting Steps -->
        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></span>
            Steps Waiting for Action
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${waitingStepsHtml}
          </table>
        </div>

        <!-- Recently Completed -->
        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #22c55e; border-radius: 50%;"></span>
            Recently Completed
          </h2>
          ${completedTasksHtml}
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${appUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Full Dashboard
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 12px; color: #94a3b8;">
          <p>This email was sent to ${memberEmail}</p>
          <p>You're receiving this because you're a team lead or admin on Task Pulse.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
