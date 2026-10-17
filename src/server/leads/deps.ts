import { D1LeadStore } from './store';
import { ConsoleMailer, ResendMailer } from '../mail/mailer';
import { verifyTurnstile } from '../security/turnstile';
import { hashIp } from '../security/hash';
import type { LeadDeps } from './service';

// The one place that turns Worker bindings and settings into lead-handling dependencies.
export function leadDepsFromEnv(env: Env): LeadDeps {
  const mailer = env.RESEND_API_KEY ? new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM) : new ConsoleMailer();
  return {
    store: new D1LeadStore(env.DB),
    mailer,
    verifyHuman: (token, ip) => verifyTurnstile(token, env.TURNSTILE_SECRET, ip),
    hashIp: (ip) => hashIp(ip, env.IP_HASH_SALT),
    config: {
      notifyTo: env.LEAD_NOTIFY_TO.split(',').map((s) => s.trim()).filter(Boolean),
      ackEnabled: env.LEAD_ACK_ENABLED === 'true',
      replyTime: env.LEAD_REPLY_TIME,
      companyName: env.COMPANY_NAME,
      siteUrl: env.SITE_URL,
    },
  };
}
