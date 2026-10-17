export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export type MailResult = { ok: true } | { ok: false; error: string };

// Email boundary. Only this file knows about Resend; another provider means one new class.
export interface Mailer {
  send(message: MailMessage): Promise<MailResult>;
}

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<MailResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      });
      if (!response.ok) {
        // Keep the provider's status for debugging; the body may echo recipients, so it is not logged.
        return { ok: false, error: `Resend responded ${response.status}` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: `Resend request failed: ${(error as Error).message}` };
    }
  }
}

/** Used in local development when no email key is configured: logs instead of sending. */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<MailResult> {
    console.log(`[mail:dev] to=${message.to.length} recipient(s) subject="${message.subject}"`);
    return { ok: true };
  }
}
