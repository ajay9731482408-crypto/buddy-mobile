/* Buddy sync Worker (your own, on Cloudflare). It stores one state document in Workers KV.
   Setup (once, on the Cloudflare dashboard):
   1. Workers & Pages → KV → Create a namespace named "buddy-mobile".
   2. Create a Worker named "buddy-sync", paste this file, then Settings → Bindings → add KV namespace:
      variable name BUDDY_KV, choose the namespace.
   3. Settings → Variables and Secrets: add SYNC_SECRET (a random 24+ character text, the one you type in the app)
      and ALLOWED_ORIGIN (the web address where your Buddy app is, e.g. https://you.github.io/buddy-mobile).
   The phone sends the SYNC_SECRET as a Bearer token. Browsers only accept answers for origins listed in ALLOWED_ORIGIN. */

const JSON_HDR = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function corsFor(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const pick = allowed.includes(origin) ? origin : (allowed[0] || 'null');
  return {
    'Access-Control-Allow-Origin': pick,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const cors = corsFor(request, env);
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...JSON_HDR, ...cors } });
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const url = new URL(request.url);
      if (url.pathname !== '/state') return json({ error: 'Not found.' }, 404);

      const auth = request.headers.get('Authorization') || '';
      const got = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!env.SYNC_SECRET || env.SYNC_SECRET.length < 16 || !same(got, env.SYNC_SECRET)) {
        return json({ error: 'The sync secret is wrong.' }, 401);
      }
      if (!env.BUDDY_KV) return json({ error: 'The storage binding BUDDY_KV is missing. See the setup notes.' }, 500);

      if (request.method === 'GET') {
        const value = await env.BUDDY_KV.get('state');
        if (value === null) return new Response('', { status: 404, headers: cors });
        return new Response(value, { headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      if (request.method === 'PUT') {
        const body = await request.text();
        if (body.length > 200000) return json({ error: 'The data is too large.' }, 413);
        try { JSON.parse(body); } catch (e) { return json({ error: 'The data is not valid JSON.' }, 400); }
        await env.BUDDY_KV.put('state', body);
        return json({ ok: true });
      }
      return json({ error: 'Method not allowed.' }, 405);
    } catch (e) {
      return json({ error: 'The sync service had a problem. Nothing was changed.' }, 500);
    }
  },
};
