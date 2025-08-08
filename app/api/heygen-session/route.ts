// GET: quick sanity — only return a count, never the whole list
export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY || '';
  const r = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'Accept': 'application/json', 'X-Api-Key': apiKey },
  });
  const j = await r.json().catch(() => ({}));
  const count =
    (Array.isArray(j?.data) && j.data.length) ||
    (Array.isArray(j?.avatars?.avatars) && j.avatars.avatars.length) || 0;

  return new Response(JSON.stringify({
    ok: r.ok,
    status: r.status,
    endpoint_used: 'https://api.heygen.com/v2/avatars',
    count
  }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}
