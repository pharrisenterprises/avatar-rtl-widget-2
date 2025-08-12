// app/api/heygen-avatars/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * Read response body exactly once as text, then JSON.parse safely.
 * This avoids "Body is unusable: already been read" errors.
 */
async function readJsonSafe(res: Response) {
  const txt = await res.text(); // read ONCE
  try {
    return { ok: true, json: JSON.parse(txt), raw: txt };
  } catch {
    return { ok: false, json: null, raw: txt };
  }
}

/**
 * Try fetching from a HeyGen URL and return normalized result.
 */
async function fetchList(url: string, apiKey: string) {
  const res = await fetch(url, {
    headers: { 'X-Api-Key': apiKey },
    cache: 'no-store',
  });

  const body = await readJsonSafe(res);

  return {
    httpOk: res.ok,
    status: res.status,
    body, // { ok, json, raw }
  };
}

export async function GET(req: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'HEYGEN_API_KEY missing' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const wanted =
    searchParams.get('name') ||
    process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME ||
    '';

  if (!wanted) {
    return NextResponse.json({ ok: false, error: 'avatar name required' }, { status: 400 });
  }

  try {
    // Try v1 first, then v2
    let out = await fetchList('https://api.heygen.com/v1/avatar', apiKey);

    if (!out.httpOk) {
      // Some orgs only have v2
      out = await fetchList('https://api.heygen.com/v2/avatars', apiKey);
    }

    if (!out.httpOk) {
      return NextResponse.json(
        {
          ok: false,
          error: 'avatar_list_error',
          status: out.status,
          bodyOk: out.body.ok,
          body: out.body.ok ? out.body.json : out.body.raw,
        },
        { status: out.status || 500 }
      );
    }

    // Normalize list from either v1 or v2
    const j = out.body.ok ? out.body.json : {};
    const list =
      j?.data?.avatars || // v2 common
      j?.avatars ||       // alternate shape
      j?.data ||          // some v1 responses
      [];

    const match = Array.isArray(list)
      ? list.find((a: any) =>
          a?.avatar_name === wanted ||
          a?.name === wanted
        )
      : null;

    if (!match) {
      return NextResponse.json(
        { ok: false, error: 'avatar_not_found', tried: wanted, total: Array.isArray(list) ? list.length : 0 },
        { status: 404 }
      );
    }

    const id = match?.avatar_id || match?.id || null;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'avatar_has_no_id', avatar: match },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id, name: wanted });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'avatar_fetch_failed' },
      { status: 500 }
    );
  }
}
