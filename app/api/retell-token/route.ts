// /app/api/retell-token/route.ts
export const runtime = 'nodejs'; // safer for fetch + env

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: 'retell-token' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST() {
  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID; // this can be agent_... (yours)

  if (!apiKey || !agentId) {
    return new Response(JSON.stringify({
      error: 'missing_env',
      detail: { RETELL_API_KEY: !!apiKey, RETELL_AGENT_ID: !!agentId }
    }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  try {
    // NOTE: host uses retellai.com (not retell.ai)
    const r = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_id: agentId }),
    });

    const text = await r.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    if (!r.ok) {
      return new Response(JSON.stringify({
        error: 'retell_fail',
        status: r.status,
        headers: Object.fromEntries(r.headers),
        detail_text: text,
        parsed_json: json
      }), { status: 500, headers: { 'Content-Type': 'application/json' }});
    }

    return new Response(JSON.stringify(json ?? { raw: text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      error: 'retell_exception',
      detail: String(err?.message || err)
    }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
}
