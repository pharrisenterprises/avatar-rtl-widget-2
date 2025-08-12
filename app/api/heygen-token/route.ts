// app/api/heygen-token/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: 'HEYGEN_API_KEY missing' }, { status: 500 });
  }

  try {
    const r = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': key,
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    });

    // Try to read JSON; if that fails, read text so we never throw HTML at the browser
    let data: any = null;
    try { data = await r.json(); } catch { data = { raw: await r.text() }; }

    if (!r.ok) {
      return NextResponse.json({ ok: false, error: data?.message || 'token_error', data }, { status: r.status });
    }

    const token = data?.token ?? data?.data?.token ?? null;
    return NextResponse.json({ ok: true, token });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'token_fetch_failed' }, { status: 500 });
  }
}
