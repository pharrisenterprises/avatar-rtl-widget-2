import { NextResponse } from 'next/server';

/**
 * GET: sanity check (so you can open /api/heygen-token in a browser and see JSON)
 */
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/heygen-token' });
}

/**
 * POST: create a short-lived Streaming Avatar session token via HeyGen API
 * Docs: https://docs.heygen.com/reference/create-session-token
 */
export async function POST() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing HEYGEN_API_KEY' }, { status: 500 });
  }

  const r = await fetch('https://api.heygen.com/v1/streaming.create_token', {
    method: 'POST',
    headers: {
      // HeyGen docs: use bearer auth
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // No body required per docs for create_token
  });

  // Parse JSON safely
  const data = await r.json().catch(() => ({} as any));

  if (!r.ok) {
    // Bubble up any API error details
    return NextResponse.json({ error: 'heygen_token_failed', detail: data }, { status: r.status });
  }

  // Docs say the token is under data.token
  const token = (data && data.data && data.data.token) ? data.data.token : undefined;
  if (!token) {
    return NextResponse.json({ error: 'no_token_in_response', detail: data }, { status: 500 });
  }

  return NextResponse.json({ token });
}
