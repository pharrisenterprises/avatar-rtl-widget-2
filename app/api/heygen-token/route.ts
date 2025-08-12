// app/api/heygen-token/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: 'HEYGEN_API_KEY missing' }, { status: 500 });
  }

  try {
    // HeyGen Streaming token endpoint
    const r = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': key,
      },
      body: JSON.stringify({}),
      // avoid Next caching
      cache: 'no-store',
    });

    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: data?.message || 'token_error', raw: data }, { status: r.status });
    }

    // Expected shape: { token: "..." }
    return NextResponse.json({ ok: true, token: data?.token ?? data?.data?.token ?? null });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'token_fetch_failed' }, { status: 500 });
  }
}
