import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/heygen-token' });
}

export async function POST() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing HEYGEN_API_KEY' }, { status: 500 });
  }

  const r = await fetch('https://api.heygen.com/v1/streaming.create_token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return NextResponse.json({ error: 'heygen_token_failed', detail: data }, { status: r.status });
  }

  const token = data?.data?.token;
  if (!token) {
    return NextResponse.json({ error: 'no_token_in_response', detail: data }, { status: 500 });
  }
  return NextResponse.json({ token });
}

