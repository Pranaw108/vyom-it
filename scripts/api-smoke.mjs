// End-to-end checks of POST /api/leads against a running local preview.
// Usage: node scripts/api-smoke.mjs [baseUrl]
import http from 'node:http';

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
const url = `${base}/api/leads`;
let failures = 0;

const valid = () => ({
  formType: 'quote',
  submissionId: crypto.randomUUID(),
  name: 'Priya Sharma',
  email: 'priya@example.com',
  phone: '+91 98765 43210',
  message: 'We need a booking app for our three clinics in Pune, with payments.',
  services: ['mobile-app-development'],
  projectType: 'new',
  platforms: 'both',
  timeline: '1-3-months',
  budget: 'prefer-not-to-say',
  preferredContact: 'email',
  consentContact: true,
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  elapsedMs: 9000,
  website: '',
});

async function post(body, { origin = base, ip = '203.0.113.7', type = 'application/json' } = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': type, Origin: origin, 'CF-Connecting-IP': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function check(name, condition, detail) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  -> ${JSON.stringify(detail)}`}`);
  if (!condition) failures++;
}

const ipA = `198.51.100.${Math.floor(Math.random() * 200)}`;

let r = await post(valid(), { ip: ipA });
check('valid quote returns 201 with reference', r.status === 201 && /^VY-\d{2}-\d{4}$/.test(r.body.reference), r);

const repeat = valid();
const first = await post(repeat, { ip: `${ipA}1` });
const second = await post(repeat, { ip: `${ipA}1` });
check('same submissionId twice returns the same reference', first.body.reference === second.body.reference && first.status === 201, { first, second });

r = await post({ ...valid(), email: 'not-an-email', name: 'x' }, { ip: `${ipA}2` });
check('invalid fields return 422 with field errors', r.status === 422 && r.body.errors?.email && r.body.errors?.name, r);

r = await post({ ...valid(), consentContact: false }, { ip: `${ipA}2` });
check('missing consent is rejected', r.status === 422 && r.body.errors?.consentContact, r);

r = await post(valid(), { origin: 'https://evil.example', ip: `${ipA}3` });
check('foreign origin returns 403', r.status === 403, r);

// Sent with node:http to check a non-JSON content type exactly as a browser form would send it.
const formStatus = await new Promise((resolve) => {
  const req = http.request(url, { method: 'POST', agent: false, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base } }, (res) => {
    res.resume();
    resolve(res.statusCode);
  });
  req.on('error', (e) => resolve(`error ${e.message}`));
  req.end('name=x');
});
check('non-JSON body returns 415', formStatus === 415, formStatus);

r = await post({ ...valid(), website: 'http://spam.example' }, { ip: `${ipA}4` });
check('honeypot gets a fake success', r.status === 201 && r.body.reference === 'VY-RECEIVED', r);

r = await post({ ...valid(), elapsedMs: 500 }, { ip: `${ipA}4` });
check('too-fast submission gets a fake success', r.status === 201 && r.body.reference === 'VY-RECEIVED', r);


const ipLimit = `192.0.2.${Math.floor(Math.random() * 200)}`;
const statuses = [];
for (let i = 0; i < 6; i++) statuses.push((await post(valid(), { ip: ipLimit })).status);
check('6th submission from one IP in 10 minutes returns 429', statuses.slice(0, 5).every((s) => s === 201) && statuses[5] === 429, statuses);

const xss = await post({ ...valid(), message: '<script>alert(1)</script> please build our site properly' }, { ip: `${ipA}6` });
check('script tags are accepted as plain text (escaped on output)', xss.status === 201, xss);

// Runs last: locally, the request after an unread-body rejection fails in the dev proxy. Re-check on the first Cloudflare preview.
r = await post('x'.repeat(12000), { ip: `${ipA}5` });
check('oversized body returns 413', r.status === 413, r);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll API checks passed');
process.exit(failures ? 1 : 0);
