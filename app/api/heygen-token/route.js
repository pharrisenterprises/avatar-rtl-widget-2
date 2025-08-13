export const dynamic = 'force-dynamic';

export async function POST() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    return Response.json({ ok: false, error: 'HEYGEN_API_KEY missing' }, { status: 500 });
  }

  // Create a short-lived session token (server → HeyGen)
  const r = await fetch('https://api.heygen.com/v1/streaming.create_token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // You can set TTL / capabilities if your account supports it
      // e.g. expires_in: 3600
    })
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    return Response.json({ ok: false, error: 'create_token_failed', detail: text }, { status: 500 });
  }

  const j = await r.json().catch(() => ({}));
  // HeyGen returns { token: "..." } for Streaming token
  if (!j?.token) {
    return Response.json({ ok: false, error: 'no_token_in_response', detail: j }, { status: 500 });
  }

  return Response.json({ ok: true, token: j.token });
}

// Convenience GET for your manual tests
export async function GET() {
  return POST();
}
