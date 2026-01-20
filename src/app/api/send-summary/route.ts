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
      // Lead and User see their assigned teams
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
    const { data: allActiveTasks } = await supabase
      .from('tasks')
      .select(`
        id, title, deadline, status, created_at,
        pipeline_steps (
          id, name, status, assigned_to, additional_assignees, step_order,
          member:members!pipeline_steps_assigned_to_fkey (name)
        ),
        team:teams (name)
      `)
      .in('team_id', teamIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    // For regular users, filter to only tasks where they have a step assigned
    // Admins and leads see all tasks in their teams
    let activeTasks = allActiveTasks;
    if (member.role === 'user') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activeTasks = allActiveTasks?.filter((task: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return task.pipeline_steps?.some((step: any) =>
          step.assigned_to === memberId ||
          (step.additional_assignees && step.additional_assignees.includes(memberId))
        );
      }) || [];
    }

    // Get recently completed tasks (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: allCompletedTasks } = await supabase
      .from('tasks')
      .select(`
        id, title, completed_at,
        pipeline_steps (
          assigned_to, additional_assignees
        ),
        team:teams (name)
      `)
      .in('team_id', teamIds)
      .eq('status', 'completed')
      .gte('completed_at', weekAgo.toISOString())
      .order('completed_at', { ascending: false });

    // For regular users, filter completed tasks too
    let completedTasks = allCompletedTasks;
    if (member.role === 'user') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      completedTasks = allCompletedTasks?.filter((task: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return task.pipeline_steps?.some((step: any) =>
          step.assigned_to === memberId ||
          (step.additional_assignees && step.additional_assignees.includes(memberId))
        );
      }) || [];
    }

    // Build pipeline scorecard data (same as dashboard)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipelineScorecard = (activeTasks || []).map((task: any) => {
      const steps = task.pipeline_steps || [];
      const completed = steps.filter((s: { status: string }) => s.status === 'completed').length;
      const total = steps.length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const currentStep = steps.find((s: { status: string }) => s.status === 'unlocked');
      return {
        title: task.title,
        completed,
        total,
        percent,
        currentStep: currentStep?.name || null,
        currentAssignee: currentStep?.member?.name || null,
        teamName: task.team?.name || '',
      };
    });

    // Build individual scorecard data (member stats)
    // Get all members relevant to the role
    let relevantMemberIds: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (activeTasks || []).forEach((task: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (task.pipeline_steps || []).forEach((step: any) => {
        if (step.assigned_to) relevantMemberIds.push(step.assigned_to);
        if (step.additional_assignees) relevantMemberIds.push(...step.additional_assignees);
      });
    });
    relevantMemberIds = [...new Set(relevantMemberIds)];

    // Get member names
    const { data: relevantMembers } = await supabase
      .from('members')
      .select('id, name')
      .in('id', relevantMemberIds);

    const memberMap = new Map((relevantMembers || []).map(m => [m.id, m.name]));

    // Calculate stats per member
    const memberStats: { id: string; name: string; now: number; next: number; done: number }[] = [];
    relevantMemberIds.forEach(mid => {
      let now = 0, next = 0, done = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (activeTasks || []).forEach((task: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (task.pipeline_steps || []).forEach((step: any) => {
          const isAssigned = step.assigned_to === mid ||
            (step.additional_assignees && step.additional_assignees.includes(mid));
          if (isAssigned) {
            if (step.status === 'completed') done++;
            else if (step.status === 'unlocked') now++;
            else if (step.status === 'locked') next++;
          }
        });
      });
      if (now + next + done > 0) {
        memberStats.push({ id: mid, name: memberMap.get(mid) || 'Unknown', now, next, done });
      }
    });
    // Sort by now (urgent first)
    memberStats.sort((a, b) => b.now - a.now || (b.now + b.next + b.done) - (a.now + a.next + a.done));

    // Build action lists for this specific member
    const nowSteps: { taskTitle: string; stepName: string }[] = [];
    const nextSteps: { taskTitle: string; stepName: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (activeTasks || []).forEach((task: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (task.pipeline_steps || []).forEach((step: any) => {
        const isAssigned = step.assigned_to === memberId ||
          (step.additional_assignees && step.additional_assignees.includes(memberId));
        if (isAssigned) {
          if (step.status === 'unlocked') {
            nowSteps.push({ taskTitle: task.title, stepName: step.name });
          } else if (step.status === 'locked') {
            nextSteps.push({ taskTitle: task.title, stepName: step.name });
          }
        }
      });
    });

    // Done = recently completed steps by this member (last 7 days)
    const doneSteps: { taskTitle: string; stepName: string; completedAt: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [...(activeTasks || []), ...(completedTasks || [])].forEach((task: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (task.pipeline_steps || []).forEach((step: any) => {
        const isAssigned = step.assigned_to === memberId ||
          (step.additional_assignees && step.additional_assignees.includes(memberId));
        if (isAssigned && step.status === 'completed' && step.completed_at) {
          const completedDate = new Date(step.completed_at);
          const weekAgoDate = new Date();
          weekAgoDate.setDate(weekAgoDate.getDate() - 7);
          if (completedDate >= weekAgoDate) {
            doneSteps.push({
              taskTitle: task.title,
              stepName: step.name,
              completedAt: step.completed_at
            });
          }
        }
      });
    });

    // Generate email HTML
    const emailHtml = generateEmailHtml({
      memberName: member.name,
      businessName,
      pipelineScorecard,
      memberStats,
      nowSteps,
      nextSteps,
      doneSteps,
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

// Generate email HTML - mirrors dashboard layout
function generateEmailHtml({
  memberName,
  businessName,
  pipelineScorecard,
  memberStats,
  nowSteps,
  nextSteps,
  doneSteps,
  memberEmail,
}: {
  memberName: string;
  businessName: string;
  pipelineScorecard: { title: string; completed: number; total: number; percent: number; currentStep: string | null; currentAssignee: string | null; teamName: string }[];
  memberStats: { id: string; name: string; now: number; next: number; done: number }[];
  nowSteps: { taskTitle: string; stepName: string }[];
  nextSteps: { taskTitle: string; stepName: string }[];
  doneSteps: { taskTitle: string; stepName: string; completedAt: string }[];
  memberEmail: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://taskpulse-nu.vercel.app';

  // Pipeline Scorecard HTML (matches dashboard)
  const pipelineCardsHtml = pipelineScorecard.length > 0
    ? pipelineScorecard.map(p => `
      <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div style="font-weight: 600; color: #1e293b; font-size: 15px;">${p.title}</div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold; color: #0d9488;">${p.percent}%</div>
            <div style="font-size: 12px; color: #94a3b8;">(${p.completed}/${p.total})</div>
          </div>
        </div>
        <!-- Progress bar -->
        <div style="display: flex; gap: 4px; margin-bottom: 12px;">
          ${Array.from({ length: p.total }).map((_, i) => `
            <div style="flex: 1; height: 8px; border-radius: 4px; background: ${i < p.completed ? 'linear-gradient(135deg, #34d399, #10b981)' : i === p.completed ? 'linear-gradient(135deg, #fb923c, #f97316)' : '#e2e8f0'};"></div>
          `).join('')}
        </div>
        <!-- Current step info -->
        <div style="background: #f0fdfa; border-radius: 8px; padding: 8px 12px; font-size: 13px;">
          ${p.currentStep ? `
            <span style="font-weight: 600; color: #0f766e; background: #ccfbf1; padding: 2px 8px; border-radius: 4px;">${p.currentAssignee || 'Unassigned'}</span>
            <span style="color: #0d9488; margin: 0 6px;">→</span>
            <span style="color: #0f766e;">${p.currentStep}</span>
          ` : `
            <span style="color: #059669; font-weight: 500;">All steps complete</span>
          `}
        </div>
      </div>
    `).join('')
    : '<div style="padding: 20px; text-align: center; color: #64748b;">No active pipelines</div>';

  // Individual Scorecard HTML (matches dashboard member cards)
  const memberCardsHtml = memberStats.length > 0
    ? `<div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${memberStats.slice(0, 8).map(m => `
          <div style="background: ${m.now > 0 ? '#fff7ed' : 'white'}; border: ${m.now > 0 ? '2px solid #fb923c' : '1px solid #e2e8f0'}; border-radius: 8px; padding: 12px; min-width: 120px; flex: 1;">
            <div style="font-weight: 500; color: #1e293b; font-size: 14px; margin-bottom: 8px;">${m.name.split(' ')[0]}</div>
            <div style="font-size: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #64748b;">Now</span>
                <span style="font-weight: 600; color: ${m.now > 0 ? '#ea580c' : '#94a3b8'};">${m.now}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #64748b;">Next</span>
                <span style="font-weight: 600; color: #2563eb;">${m.next}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Done</span>
                <span style="font-weight: 600; color: #059669;">${m.done}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`
    : '';

  // Now steps (your unlocked steps) - table format
  const nowTableHtml = nowSteps.length > 0
    ? nowSteps.map(s => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 500; color: #1e293b;">${s.stepName}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Pipeline: ${s.taskTitle}</div>
        </td>
      </tr>
    `).join('')
    : `<tr><td style="padding: 20px; text-align: center; color: #64748b;">No steps waiting for you</td></tr>`;

  // Next steps (your locked steps) - table format
  const nextTableHtml = nextSteps.length > 0
    ? nextSteps.slice(0, 5).map(s => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 500; color: #1e293b;">${s.stepName}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Pipeline: ${s.taskTitle}</div>
        </td>
      </tr>
    `).join('')
    : `<tr><td style="padding: 20px; text-align: center; color: #64748b;">No upcoming steps</td></tr>`;

  // Done steps (your completed steps in last 7 days) - table format
  const doneTableHtml = doneSteps.length > 0
    ? doneSteps.slice(0, 5).map(s => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 500; color: #1e293b;">${s.stepName}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Pipeline: ${s.taskTitle} • ${new Date(s.completedAt).toLocaleDateString()}</div>
        </td>
      </tr>
    `).join('')
    : `<tr><td style="padding: 20px; text-align: center; color: #64748b;">No steps completed this week</td></tr>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #115e59 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: white;">Task Pulse</h1>
          <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Hi ${memberName}, here's your dashboard summary</p>
          <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">${businessName}</p>
        </div>

        <!-- Pipeline Scorecard -->
        <div style="background: linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #059669 100%); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
            <div style="background: rgba(255,255,255,0.15); padding: 8px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);">
              <span style="font-size: 28px; font-weight: bold; color: white;">${pipelineScorecard.length}</span>
              <span style="font-size: 14px; color: #ccfbf1; margin-left: 8px;">pipeline${pipelineScorecard.length !== 1 ? 's' : ''}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 10px; height: 10px; background: #34d399; border-radius: 50%;"></div>
              <span style="font-size: 14px; font-weight: 600; color: white;">ACTIVE</span>
              <span style="font-size: 13px; color: #99f6e4;">— waiting on</span>
            </div>
          </div>
          ${pipelineCardsHtml}
        </div>

        <!-- Individual Scorecard -->
        ${memberStats.length > 0 ? `
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Team Members</h2>
          ${memberCardsHtml}
        </div>
        ` : ''}

        <!-- Now - Steps Waiting for Action -->
        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #f97316; border-radius: 50%;"></span>
            Now — Steps Waiting for You
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${nowTableHtml}
          </table>
        </div>

        <!-- Next - Coming to You -->
        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #3b82f6; border-radius: 50%;"></span>
            Next — Coming to You
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${nextTableHtml}
          </table>
        </div>

        <!-- Done - Recently Completed -->
        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
            Done — Completed This Week
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${doneTableHtml}
          </table>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${appUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Full Dashboard
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">This email was sent to ${memberEmail}</p>
          <p style="margin: 4px 0 0 0;">Task Pulse by Cabin</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
