import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing HEYGEN_API_KEY' }, { status: 500 });

  const r = await fetch('https://api.heygen.com/v1/streaming/avatar.list', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  const data = await r.json().catch(() => ({} as any));
  if (!r.ok) {
    return NextResponse.json({ error: 'avatar_list_failed', detail: data }, { status: r.status });
  }
  return NextResponse.json(data);
}
