// /app/api/heygen-session/route.ts
export const runtime = 'nodejs';

/**
 * GET: convenience list check (shows your v2 avatars count)
 * Use this to verify your HEYGEN_API_KEY is on the account that owns Ilia.
 */
export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY || '';
  const r = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'Accept': 'application/json', 'X-Api-Key': apiKey },
  });

  const text = await r.text();
  let json: any = undefined; try { json = JSON.parse(text); } catch {}

  const count = Array.isArray(json?.data) ? json.data.length : 0;
  return new Response(JSON.stringify({
    ok: r.ok, status: r.status,
    endpoint_used: 'https://api.heygen.com/v2/avatars',
    count,
    avatars: Array.isArray(json?.data) ? json.data : [],
  }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}

/**
 * POST: create a Streaming session for Interactive Avatar
 * Reads avatarId/voiceId from JSON body OR falls back to env vars.
 * Expected success returns session info (access_token + endpoints).
 */
export async function POST(request: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing HEYGEN_API_KEY' }), { status: 500 });
  }

  const body = await request.json().catch(() => ({})) as {
    avatarId?: string; voiceId?: string; quality?: 'high'|'medium'|'low';
  };

  const avatarId = body.avatarId || process.env.HEYGEN_AVATAR_ID;
  const voiceId  = body.voiceId  || process.env.HEYGEN_VOICE_ID;
  const quality  = body.quality  || 'high';

  if (!avatarId) {
    return new Response(JSON.stringify({
      error: 'Missing avatar_id',
      fix: 'Provide avatarId in body or set HEYGEN_AVATAR_ID env var.',
    }), { status: 400 });
  }

  // Primary v2 endpoint for interactive streaming sessions
  const url = 'https://api.heygen.com/v2/streaming.new';

  const payload: any = { avatar_id: avatarId, quality };
  if (voiceId) payload.voice = { voice_id: voiceId };

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await r.text();
  let json: any = undefined; try { json = JSON.parse(text); } catch {}

  if (!r.ok) {
    return new Response(JSON.stringify({
      error: 'heygen_fail',
      status: r.status,
      endpoint_used: url,
      request_payload: payload,
      detail_text: text,
      parsed_json: json,
    }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  // Success. HeyGen usually returns data: { session_id, access_token, url/realtime_endpoint, ... }
  return new Response(JSON.stringify({ ok: true, endpoint_used: url, data: json?.data ?? json }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

