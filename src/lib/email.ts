import nodemailer from "nodemailer";
import path from "path";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USERNAME = process.env.SMTP_USERNAME || "";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USERNAME;

export function hasEmailConfig(): boolean {
  return Boolean(SMTP_HOST && SMTP_USERNAME && SMTP_PASSWORD);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for 587 (STARTTLS)
    auth: {
      user: SMTP_USERNAME,
      pass: SMTP_PASSWORD,
    },
    tls: {
      // Require TLS for security
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

export interface ReminderEmailOptions {
  to: string;
  toName: string;
  reminderTitle: string;
  reminderMessage: string;
}

/** Absolute path to the piggy-bank logo inside the public folder */
const LOGO_PATH = path.join(process.cwd(), "public", "favicon.svg");

export async function sendReminderEmail(options: ReminderEmailOptions): Promise<void> {
  if (!hasEmailConfig()) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD.");
  }

  const transporter = createTransporter();

  // Inline HTML email with piggy-bank logo (cid attachment)
  const html = buildEmailHtml(options);

  await transporter.sendMail({
    from: `"💰 Money Manager" <${SMTP_FROM}>`,
    to: `"${options.toName}" <${options.to}>`,
    subject: "💰 Money Manager Reminder",
    text: `${options.reminderTitle}\n\n${options.reminderMessage}`,
    html,
    attachments: [
      {
        filename: "logo.svg",
        path: LOGO_PATH,
        cid: "moneymanager-logo", // referenced as cid:moneymanager-logo in HTML
      },
    ],
  });
}

function buildEmailHtml({ reminderTitle, reminderMessage, toName }: ReminderEmailOptions): string {
  // Escape HTML entities to prevent injection
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Money Manager Reminder</title>
</head>
<body style="margin:0;padding:0;background:#0D1117;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#141A24;border:1px solid #263145;border-radius:24px;overflow:hidden;max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a5f 0%,#0e7490 100%);padding:32px 36px;text-align:center;">
              <img src="cid:moneymanager-logo" alt="Money Manager" width="56" height="56"
                   style="border-radius:16px;margin-bottom:12px;display:block;margin:0 auto 12px;" />
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                💰 Money Manager
              </h1>
              <p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">Reminder Notification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">Hi ${esc(toName)},</p>
              <h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;font-weight:700;">${esc(reminderTitle)}</h2>
              <p style="margin:0 0 28px;color:#cbd5e1;font-size:15px;line-height:1.6;">${esc(reminderMessage).replace(/\n/g, "<br/>")}</p>

              <div style="background:#1C2433;border:1px solid #263145;border-radius:14px;padding:16px 20px;">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                  This reminder was sent from your <strong style="color:#38bdf8;">Money Manager</strong> account.
                  Manage your reminders anytime from the Reminders page.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 36px 28px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:11px;">
                © ${new Date().getFullYear()} Money Manager &mdash; Keep your finances on track.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
