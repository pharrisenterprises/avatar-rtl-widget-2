import { NextResponse } from 'next/server';

/** Simple sanity check with GET */
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/retell-webcall' });
}

/** Create a Retell Web Call and return access_token */
export async function POST() {
  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID;

  if (!apiKey) return NextResponse.json({ error: 'Missing RETELL_API_KEY' }, { status: 500 });
  if (!agentId) return NextResponse.json({ error: 'Missing RETELL_AGENT_ID' }, { status: 500 });

  const r = await fetch('https://api.retellai.com/v2/create-web-call', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ agent_id: agentId })
  });

  const data = await r.json().catch(() => ({} as any));
  if (!r.ok) {
    return NextResponse.json({ error: 'retell_create_web_call_failed', detail: data }, { status: r.status });
  }

  const access_token = data?.access_token;
  const call_id = data?.call_id;

  if (!access_token) {
    return NextResponse.json({ error: 'no_access_token_in_response', detail: data }, { status: 500 });
  }

  return NextResponse.json({ access_token, call_id });
}
