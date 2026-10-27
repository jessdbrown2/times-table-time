// Times Table Time — data API (Cloudflare Worker)
// Requires a KV namespace binding named TTT (namespace: "times-table-time").

const ALLOWED_ORIGIN = 'https://jessdbrown2.github.io';
const KEY_OK = /^(settings|stats|s:[0-9a-z-]{1,40})$/;

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);

    // Last 60 sessions (session ids start with the date, so key order = date order)
    if (url.pathname === '/sessions' && req.method === 'GET') {
      let keys = [], cursor;
      do {
        const page = await env.TTT.list({ prefix: 's:', cursor });
        keys = keys.concat(page.keys);
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      const sessions = keys.slice(-60).map(k => k.metadata).filter(Boolean);
      return json({ sessions });
    }

    // For the Shortcuts check: /done?date=YYYY-MM-DD -> "yes" or "no"
    if (url.pathname === '/done' && req.method === 'GET') {
      const date = url.searchParams.get('date') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response('no', { headers: cors });
      const page = await env.TTT.list({ prefix: 's:' + date });
      const done = page.keys.some(k => k.metadata && k.metadata.completed);
      return new Response(done ? 'yes' : 'no', { headers: { ...cors, 'content-type': 'text/plain' } });
    }

    const m = url.pathname.match(/^\/doc\/(.+)$/);
    if (m) {
      const key = decodeURIComponent(m[1]);
      if (!KEY_OK.test(key)) return json({ error: 'bad key' }, 400);

      if (req.method === 'GET') {
        const value = await env.TTT.get(key, 'json');
        return json({ value });
      }
      if (req.method === 'PUT') {
        const text = await req.text();
        if (text.length > 60000) return json({ error: 'too large' }, 413);
        let value;
        try { value = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) return json({ error: 'bad body' }, 400);
        const opts = {};
        if (key.startsWith('s:')) {
          const { id, date, startedAt, activeSec, answered, correct, completed, goalMin } = value;
          opts.metadata = { id, date, startedAt, activeSec, answered, correct, completed, goalMin };
        }
        await env.TTT.put(key, text, opts);
        return new Response(null, { status: 204, headers: cors });
      }
    }
    return json({ error: 'not found' }, 404);
  },
};
