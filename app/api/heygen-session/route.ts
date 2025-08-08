// /app/api/heygen-avatars/route.ts
export const runtime = 'nodejs';

// Use the v2 list endpoint per your docs
const URL = 'https://api.heygen.com/v2/avatars';

export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'missing_env', HEYGEN_API_KEY: false }), { status: 500 });
  }

  try {
    const r = await fetch(URL, {
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': apiKey,
      },
    });

    const text = await r.text();
    let json: any = undefined;
    try { json = JSON.parse(text); } catch {}

    if (!r.ok || !json) {
      return new Response(JSON.stringify({
        error: 'list_avatars_failed',
        status: r.status,
        detail_text: text,
      }), { status: 500, headers: { 'Content-Type': 'application/json' }});
    }

    // Normalize to { avatars: [ { id, name } ] }
    const avatars = Array.isArray(json?.data) ? json.data : [];
    const mapped = avatars.map((a: any) => ({
      id: a?.avatar_id || a?.id,
      name: a?.name || a?.display_name || 'Unnamed',
      raw: a
    })).filter((v: any) => v.id);

    return new Response(JSON.stringify({
      ok: true,
      endpoint_used: URL,
      count: mapped.length,
      avatars: mapped
    }), { status: 200, headers: { 'Content-Type': 'application/json' }});

  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'exception', detail: String(e?.message || e) }), { status: 500 });
  }
}
