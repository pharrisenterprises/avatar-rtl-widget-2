export const dynamic = 'force-dynamic';

async function createToken() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    return Response.json({ ok: false, error: 'HEYGEN_API_KEY missing' }, { status: 500 });
  }

  const r = await fetch('https://api.heygen.com/v1/streaming.create_token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({}) // (optionally) { expires_in: 3600 }
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    return Response.json({ ok: false, error: 'create_token_failed', detail: text }, { status: 502 });
  }

  const j = await r.json().catch(() => ({}));
  if (!j?.token) {
    return Response.json({ ok: false, error: 'no_token_in_response', detail: j }, { status: 502 });
  }

  return Response.json({ ok: true, token: j.token });
}

export async function GET()  { return createToken(); }
export async function POST() { return createToken(); }
