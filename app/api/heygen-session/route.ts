// /app/api/heygen-session/route.ts
export const runtime = 'nodejs';

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: 'heygen-session' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

type TryResp = { url: string; status: number; ok: boolean; json?: any; text?: string; };

export async function POST(request: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'missing_env', HEYGEN_API_KEY: false }), { status: 500 });
  }

  // Pull avatarId/voiceId from request body OR fall back to env vars
  const body = await request.json().catch(() => ({})) as {
    avatarId?: string; voiceId?: string; quality?: 'high'|'medium'|'low';
  };
  const avatarId = body.avatarId || process.env.HEYGEN_AVATAR_ID || '';
  const voiceId  = body.voiceId  || process.env.HEYGEN_VOICE_ID  || '';
  const quality  = body.quality  || 'high';

  if (!avatarId) {
    return new Response(JSON.stringify({
      error: 'missing_avatar_id',
      detail: 'Provide avatarId in body or set HEYGEN_AVATAR_ID in Vercel env.'
    }), { status: 400, headers: { 'Content-Type': 'application/json' }});
  }

  // Try v2 first, then v1 fallbacks (tenants vary)
  const candidates = [
    'https://api.heygen.com/v2/streaming.new',
    'https://api.heygen.com/v2/streaming.create_session',
    'https://api.heygen.com/v1/streaming.new',
    'https://api.heygen.com/v1/streaming.create_session',
    'https://api.heygen.com/v1/avatars/streaming.new',
  ];

  const payload: any = { quality, avatar_id: avatarId };
  if (voiceId) payload.voice = { voice_id: voiceId };

  const tried: TryResp[] = [];

  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let json: any = undefined;
      try { json = JSON.parse(text); } catch {}

      tried.push({ url, status: r.status, ok: r.ok, json, text: r.ok ? undefined : text });
      if (r.ok && json) {
        return new Response(JSON.stringify({ ok: true, endpoint_used: url, data: json }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (e: any) {
      tried.push({ url, status: 0, ok: false, text: String(e?.message || e) });
    }
  }

  return new Response(JSON.stringify({ error: 'heygen_fail_all', tried, payload }), {
    status: 500, headers: { 'Content-Type': 'application/json' }
  });
}
