// /app/api/retell-token/route.ts
export const runtime = 'edge';

// Health check (GET)
export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: 'retell-token' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Real token (POST)
export async function POST() {
  const r = await fetch('https://api.retell.ai/v2/create-web-call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: process.env.RETELL_AGENT_ID
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    return new Response(JSON.stringify({ error: 'retell_fail', detail: txt }), { status: 500 });
  }

  const data = await r.json();
  return new Response(JSON.stringify(data), { 
    status: 200, 
    headers: { 'Content-Type': 'application/json' }
  });
}
