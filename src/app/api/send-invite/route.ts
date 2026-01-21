import { NextRequest, NextResponse } from 'next/server';

// POST /api/send-invite - Send an invite email to a member
export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const memberName = name || 'there';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://taskpulse-nu.vercel.app';

    // Generate invite email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #0d9488;">Task Pulse</h1>
          </div>

          <!-- Content Card -->
          <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1e293b;">Hi ${memberName}!</h2>

            <p style="margin: 0 0 16px 0; color: #475569; font-size: 16px; line-height: 1.6;">
              You've been added to Task Pulse, a pipeline-based task management tool.
            </p>

            <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
              Click the button below to create your account and get started.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${appUrl}/login" style="display: inline-block; background-color: #0d9488; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Create Your Account
              </a>
            </div>

            <p style="margin: 0; color: #94a3b8; font-size: 14px; text-align: center;">
              Use this email address to sign up: <strong style="color: #475569;">${email}</strong>
            </p>
          </div>

          <!-- Footer -->
          <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p>This invite was sent to ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email using Resend
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured - invite not sent');
      return NextResponse.json({
        success: true,
        message: 'Invite would be sent (RESEND_API_KEY not configured)',
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
        to: email,
        subject: "You're invited to Task Pulse",
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('Resend error:', errorData);
      const errorMessage = errorData?.message || errorData?.error || 'Failed to send invite';
      return NextResponse.json(
        { error: errorMessage, details: errorData },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invite sent to ${email}`,
    });

  } catch (error) {
    console.error('Send invite error:', error);
    return NextResponse.json(
      { error: 'Failed to send invite' },
      { status: 500 }
    );
  }
}
