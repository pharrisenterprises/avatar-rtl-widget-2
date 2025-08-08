// /app/api/retell-token/route.ts
export const runtime = 'edge';

// Health check (GET)
export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: 'retell-token' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Create a Retell web-call token (POST)
export async function POST() {
  try {
    const apiKey = process.env.RETELL_API_KEY;
    const agentId = process.env.RETELL_AGENT_ID;

    if (!apiKey || !agentId) {
      return new Response(
        JSON.stringify({ error: 'missing_env', detail: 'RETELL_API_KEY or RETELL_AGENT_ID not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const r = await fetch('https://api.retell.ai/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_id: agentId }),
    });

    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }

    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: 'retell_fail', status: r.status, detail: text }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'retell_exception', detail: String(err?.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
