// app/api/heygen-avatars/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

type HeygenAvatar = {
  avatar_id: string;
  name?: string;
};

export async function GET(req: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get('name') || '').trim();

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'HEYGEN_API_KEY missing' }, { status: 500 });
  }
  if (!raw) {
    return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.heygen.com/v1/avatars', {
      headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' },
      cache: 'no-store',
    });

    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, body: data ?? text }, { status: res.status });
    }

    const items: HeygenAvatar[] = data?.data ?? data?.avatars ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'no_avatars_returned' }, { status: 404 });
    }

    const q = raw.toLowerCase();

    // 1) exact name match (case-insensitive)
    let match = items.find(a => (a.name || '').toLowerCase() === q);

    // 2) contains match (e.g., "conrad_sitting")
    if (!match) match = items.find(a => (a.name || '').toLowerCase().includes(q));

    // 3) startsWith match (sometimes names have suffixes)
    if (!match) match = items.find(a => (a.name || '').toLowerCase().startsWith(q));

    if (!match) {
      return NextResponse.json(
        { ok: false, error: 'avatar_not_found', tried: raw, total: items.length },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, id: match.avatar_id, name: match.name });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'lookup_failed' }, { status: 500 });
  }
}
