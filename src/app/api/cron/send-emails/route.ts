import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// This endpoint is called by Vercel Cron daily at 8 AM UTC
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/send-emails", "schedule": "0 8 * * *" }] }
export async function GET(request: NextRequest) {
  // Verify cron secret for security (required in production)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Reject if: no secret configured OR header doesn't match
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday
    const dayOfMonth = now.getUTCDate();

    // Get all admins and leads with email settings
    const { data: members, error } = await supabase
      .from('members')
      .select(`
        id,
        name,
        email,
        role,
        business_id,
        email_settings (
          frequency,
          last_sent_at
        )
      `)
      .not('email', 'is', null)
      .in('role', ['admin', 'lead']);

    if (error) throw error;

    const results: { email: string; status: string }[] = [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://taskpulse-nu.vercel.app';

    for (const member of members || []) {
      // Get frequency setting (default to weekly)
      const settings = Array.isArray(member.email_settings)
        ? member.email_settings[0]
        : member.email_settings;
      const frequency = settings?.frequency || 'weekly';

      // Determine if we should send based on frequency
      let shouldSend = false;
      switch (frequency) {
        case 'daily':
          shouldSend = true;
          break;
        case 'weekly':
          // Send on Mondays
          shouldSend = dayOfWeek === 1;
          break;
        case 'monthly':
          // Send on 1st of month
          shouldSend = dayOfMonth === 1;
          break;
        case 'none':
          shouldSend = false;
          break;
      }

      if (!shouldSend) {
        results.push({ email: member.email, status: `skipped (${frequency})` });
        continue;
      }

      // Send the email
      try {
        const response = await fetch(`${appUrl}/api/send-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: member.id }),
        });

        if (response.ok) {
          results.push({ email: member.email, status: 'sent' });
        } else {
          const errorData = await response.json();
          results.push({ email: member.email, status: `failed: ${errorData.error}` });
        }
      } catch (sendError) {
        results.push({ email: member.email, status: `error: ${sendError}` });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      processed: results.length,
      results,
    });

  } catch (error) {
    console.error('Cron send-emails error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
