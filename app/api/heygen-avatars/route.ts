// /app/api/heygen-avatars/route.ts
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'missing_env', HEYGEN_API_KEY: false }), { status: 500 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 32)));

  // Official v2 list endpoint
  const r = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'Accept': 'application/json', 'X-Api-Key': apiKey },
  });

  const text = await r.text();
  let json: any = undefined; try { json = JSON.parse(text); } catch {}

  if (!r.ok || !json) {
    return new Response(JSON.stringify({
      error: 'list_avatars_failed',
      status: r.status,
      detail_text: text,
    }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  // Some tenants return { data: [...] }, some return { avatars: { avatars: [...] } }
  const raw =
    (Array.isArray(json?.data) && json.data) ||
    (Array.isArray(json?.avatars?.avatars) && json.avatars.avatars) ||
    [];

  // Normalize to a small shape
  let items = raw.map((a: any) => ({
    id: a?.avatar_id || a?.id,
    name: a?.avatar_name || a?.name || a?.display_name || 'Unnamed',
    thumb: a?.preview_image_url || a?.image_url || null,
  })).filter((x: any) => x.id);

  if (q) {
    items = items.filter(x => x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q));
  }

  const total = items.length;
  items = items.slice(0, limit);

  return new Response(JSON.stringify({
    ok: true,
    count: total,
    returned: items.length,
    avatars: items,
  }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}
