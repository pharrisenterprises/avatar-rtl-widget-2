// app/api/heygen-token/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'HEYGEN_API_KEY missing' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      'https://api.heygen.com/v1/streaming.create_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({}),
        cache: 'no-store',
      }
    );

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, body: json ?? text },
        { status: res.status }
      );
    }

    const token = json?.data?.token ?? json?.token;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'no_token_in_response', body: json ?? text },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, token });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'token_fetch_failed' },
      { status: 500 }
    );
  }
}
