import "server-only";
import { Resend } from "resend";
import { log } from "@/lib/logger";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "Itemize It <noreply@itemize-it.com>";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
}

// ============================================
// Team invitation email
// ============================================

interface InviteEmailParams {
  to: string;
  token: string;
  role: string;
  businessName: string;
  inviterName?: string;
}

export async function sendInvitationEmail({
  to,
  token,
  role,
  businessName,
  inviterName,
}: InviteEmailParams): Promise<{ success: boolean; error?: string }> {
  const acceptUrl = `${getAppUrl()}/auth/accept-invite?token=${token}`;
  const invitedBy = inviterName ? ` by ${inviterName}` : "";

  try {
    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `You've been invited to join ${businessName} on Itemize It`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0F1115;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F1115;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:24px 32px 20px;background-color:#1C1F26;border-radius:12px 12px 0 0;border-bottom:1px solid #2A2F3A;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">Itemize It</span>
              </td>
              <td align="right">
                <span style="display:inline-block;background-color:#FF5F00;color:#FFFFFF;font-size:11px;font-weight:600;padding:4px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">Team Invite</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;background-color:#1C1F26;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#FFFFFF;line-height:1.3;">
            You're invited to join<br/><span style="color:#FF5F00;">${businessName}</span>
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#9CA3AF;line-height:1.6;">
            ${inviterName ? `<strong style="color:#FFFFFF;">${inviterName}</strong> has invited you` : "You've been invited"} to join as a <strong style="color:#FFFFFF;">${role}</strong>. Accept the invitation below to get started.
          </p>

          <!-- CTA Button -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="border-radius:8px;background-color:#FF5F00;">
              <a href="${acceptUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
                Accept Invitation
              </a>
            </td></tr>
          </table>

          <!-- Info box -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:16px;background-color:#0F1115;border-radius:8px;border:1px solid #2A2F3A;">
              <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">
                <strong style="color:#FFFFFF;">What is Itemize It?</strong><br/>
                Receipt tracking and expense management built for small businesses. Capture, categorize, and export your receipts with AI.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;background-color:#1C1F26;border-radius:0 0 12px 12px;border-top:1px solid #2A2F3A;">
          <p style="margin:0 0 8px;font-size:12px;color:#9CA3AF;line-height:1.5;">
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>
          <p style="margin:0;font-size:11px;color:#4B5563;">
            Itemize It &mdash; Receipt tracking for small business
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `,
    });

    if (error) {
      log.error("Failed to send invitation email", { to, error: error.message });
      return { success: false, error: error.message };
    }

    log.info("Invitation email sent", { to, businessName });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("Invitation email exception", { to, error: message });
    return { success: false, error: message };
  }
}
