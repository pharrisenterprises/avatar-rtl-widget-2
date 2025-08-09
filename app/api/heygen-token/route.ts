// app/api/heygen-token/route.ts
export const runtime = 'edge';

export async function GET() {
  // Health check (open in browser to verify)
  return new Response(JSON.stringify({ ok: true, route: 'heygen-token' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST() {
  const r = await fetch('https://api.heygen.com/v1/streaming.create_token', {
    method: 'POST',
    headers: {
      'X-Api-Key': process.env.HEYGEN_API_KEY as string,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({}) // no body needed per docs
  });

  if (!r.ok) {
    const txt = await r.text();
    return new Response(JSON.stringify({ error: 'heygen_token_fail', detail: txt }), { status: 500 });
  }

  const data = await r.json(); // { error: null, data: { token: '...' } }
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
