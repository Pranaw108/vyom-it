// Worker entry: Astro handles requests; the scheduled handler runs the lead email retries and retention.
import { handle } from '@astrojs/cloudflare/handler';
import { applyRetention, retryLeadEmails } from './server/leads/service';
import { leadDepsFromEnv } from './server/leads/deps';
import { AuditLog } from './server/admin/audit';

export default {
  async fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    const deps = leadDepsFromEnv(env);
    if (controller.cron === '0 3 * * *') {
      ctx.waitUntil(applyRetention(deps).then((n) => console.log(`retention: erased ${n} lead(s)`)));
      ctx.waitUntil(new AuditLog(env.DB).purgeExpired().then((n) => n && console.log(`retention: removed ${n} audit entr${n === 1 ? 'y' : 'ies'}`)));
      return;
    }
    ctx.waitUntil(retryLeadEmails(deps).then((n) => n && console.log(`retry: processed ${n} lead(s)`)));
  },
} satisfies ExportedHandler<Env>;
