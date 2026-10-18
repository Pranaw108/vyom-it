// Creates a one-time link for an existing admin account to set (or reset) its password.
// Run it yourself in a terminal: the link is printed only there and is never stored in plain text.
// Usage: node scripts/admin-setup-link.mjs <username> --remote --site https://your-site
//        node scripts/admin-setup-link.mjs <username> --local
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const username = (process.argv[2] ?? '').toLowerCase();
const target = process.argv.includes('--remote') ? '--remote' : '--local';
const siteArg = process.argv.indexOf('--site');
const site = siteArg > 0 ? process.argv[siteArg + 1] : 'http://127.0.0.1:4321';
if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || !site?.startsWith('http')) {
  console.error('Usage: node scripts/admin-setup-link.mjs <username> (--local | --remote --site https://your-site)');
  process.exit(1);
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = b64url(randomBytes(32));
const tokenHash = b64url(createHash('sha256').update(token).digest());
const now = new Date();
const expires = new Date(now.getTime() + 24 * 3_600_000).toISOString();

// Earlier unused links for this account stop working; the new one is valid for 24 hours.
const sql = `
UPDATE account_tokens SET used_at = '${now.toISOString()}'
  WHERE user_id = (SELECT id FROM users WHERE username = '${username}') AND used_at IS NULL;
INSERT INTO account_tokens (token_hash, user_id, purpose, created_by, created_at, expires_at)
  SELECT '${tokenHash}', id, CASE WHEN password_hash IS NULL THEN 'setup' ELSE 'reset' END, NULL, '${now.toISOString()}', '${expires}'
  FROM users WHERE username = '${username}' AND status = 'active';
INSERT INTO audit_log (actor_id, actor_email, action, entity, entity_id, summary)
  SELECT NULL, 'cli', 'user.reset_link', 'user', id, 'One-time password link created from the command line'
  FROM users WHERE username = '${username}' AND status = 'active';
SELECT COUNT(*) AS created FROM account_tokens WHERE token_hash = '${tokenHash}';`;

// Calls Wrangler with node directly (no shell), so the SQL is passed as one argument on every OS.
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const run = (args) => execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'vyom-website', target, ...args], { encoding: 'utf8' });
const result = JSON.parse(run(['--json', '--command', sql.replace(/\s+/g, ' ')]));
const created = result.at(-1)?.results?.[0]?.created ?? 0;
if (created !== 1) {
  console.error(`No active account named "${username}" was found. Nothing was created.`);
  process.exit(1);
}

console.log(`\nOne-time password link for ${username} (valid 24 hours, works once):\n\n  ${site.replace(/\/$/, '')}/auth/setup?token=${token}\n`);
console.log('Open it in your browser. Do not paste it into chats or tickets.\n');
