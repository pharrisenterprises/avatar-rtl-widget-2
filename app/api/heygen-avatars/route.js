// app/api/heygen-avatars/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const name = (url.searchParams.get('name') || '').trim();

    // Prefer explicit ID from env (most reliable)
    const id = process.env.HEYGEN_AVATAR_ID || '';
    if (id) {
      return new Response(JSON.stringify({ ok: true, id, source: 'env_id', nameHint: name }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Fallback: name lookup (optional)
    if (!name) {
      return new Response(JSON.stringify({ ok: false, error: 'name_required' }), {
        status: 400, headers: { 'content-type': 'application/json' }
      });
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: 'HEYGEN_API_KEY missing' }), {
        status: 500, headers: { 'content-type': 'application/json' }
      });
    }

    const r = await fetch('https://api.heygen.com/v1/avatars', {
      headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' },
      cache: 'no-store',
    });

    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}

    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, status: r.status, body: data ?? text }), {
        status: r.status, headers: { 'content-type': 'application/json' }
      });
    }

    const items = data?.data || data?.avatars || [];
    const q = name.toLowerCase();

    let match = items.find(a => (a.avatar_id || '').toLowerCase() === q)
             || items.find(a => (a.avatar_id || '').toLowerCase().includes(q))
             || items.find(a => (a.avatar_id || '').toLowerCase().startsWith(q));

    if (!match) {
      return new Response(JSON.stringify({ ok: false, error: 'avatar_not_found', tried: name, total: items.length }), {
        status: 404, headers: { 'content-type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, id: match.avatar_id, source: 'lookup' }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'lookup_failed' }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
