// app/api/heygen-avatars/route.ts
import { NextResponse } from 'next/server';

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
    // HeyGen Avatars list
    const r = await fetch('https://api.heygen.com/v1/avatar', {
      method: 'GET',
      headers: { 'X-Api-Key': key },
      cache: 'no-store',
    });

    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: data?.message || 'avatar_list_error', raw: data }, { status: r.status });
    }

    // Find by avatar_name exact match
    const items: any[] = data?.data?.avatars || data?.avatars || [];
    const match = items.find(a => a?.avatar_name === wanted);

    if (!match) {
      return NextResponse.json({ ok: false, error: 'avatar_not_found', tried: wanted }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: match?.avatar_id || match?.id, name: wanted });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'avatar_fetch_failed' }, { status: 500 });
  }
}
