// app/api/heygen-avatars/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

async function getJsonSafe(r: Response) {
  try { return await r.json(); } catch { return { raw: await r.text() }; }
}

export async function GET(req: Request) {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: 'HEYGEN_API_KEY missing' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const wanted = searchParams.get('name') || process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';
  if (!wanted) {
    return NextResponse.json({ ok: false, error: 'avatar name required' }, { status: 400 });
  }

  try {
    // Try v1, then fall back to v2 if needed. Some accounts only expose v2.
    const tryOnce = async (url: string) => {
      const r = await fetch(url, { headers: { 'X-Api-Key': key }, cache: 'no-store' });
      const data: any = await getJsonSafe(r);
      return { ok: r.ok, data, status: r.status };
    };

    let out = await tryOnce('https://api.heygen.com/v1/avatar');
    if (!out.ok) out = await tryOnce('https://api.heygen.com/v2/avatars');

    if (!out.ok) {
      return NextResponse.json({ ok: false, error: 'avatar_list_error', status: out.status, data: out.data }, { status: out.status || 500 });
    }

    // Normalize list
    const list = out.data?.data?.avatars || out.data?.avatars || out.data?.data || [];
    const match = Array.isArray(list)
      ? list.find((a: any) => a?.avatar_name === wanted || a?.name === wanted)
      : null;

    if (!match) {
      return NextResponse.json({ ok: false, error: 'avatar_not_found', tried: wanted }, { status: 404 });
    }

    const id = match?.avatar_id || match?.id;
    return NextResponse.json({ ok: true, id, name: wanted });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'avatar_fetch_failed' }, { status: 500 });
  }
}
