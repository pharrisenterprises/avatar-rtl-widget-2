// /app/api/heygen-session/route.ts
export const runtime = 'nodejs';

/** GET: sanity check — shows how many avatars your key sees */
export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY || '';
  const r = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'Accept': 'application/json', 'X-Api-Key': apiKey },
  });
  const j = await r.json().catch(() => ({}));
  const count = Array.isArray(j?.data) ? j.data.length : (Array.isArray(j?.avatars?.avatars) ? j.avatars.avatars.length : 0);
  return new Response(JSON.stringify({
    ok: r.ok, status: r.status,
    endpoint_used: 'https://api.heygen.com/v2/avatars',
    count
  }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}

/** POST: create a Streaming session for an avatar */
export async function POST(request: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return jsonErr('Missing HEYGEN_API_KEY', 500);

  const body = await request.json().catch(() => ({})) as {
    avatarId?: string;
    avatarName?: string;
    voiceId?: string;
    quality?: 'high'|'medium'|'low';
  };

  // Resolve avatar id: explicit → env → (optionally by name)
  let avatarId = body.avatarId || process.env.HEYGEN_AVATAR_ID || '';
  const avatarName = (body.avatarName || '').trim();

  if (!avatarId && avatarName) {
    avatarId = await findAvatarIdByName(apiKey, avatarName) || '';
  }
  if (!avatarId) return jsonErr('Missing avatar_id. Provide avatarId or set HEYGEN_AVATAR_ID.', 400);

  const payload: any = { avatar_id: avatarId, quality: body.quality || 'high' };
  const voiceId = body.voiceId || process.env.HEYGEN_VOICE_ID;
  if (voiceId) payload.voice = { voice_id: voiceId };

  const url = 'https://api.heygen.com/v2/streaming.new';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
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

  // Success — return whatever HeyGen returns (usually data.{ session_id, access_token, url/realtime_endpoint, player_url? })
  return new Response(JSON.stringify({ ok: true, endpoint_used: url, data: json?.data ?? json }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}

function jsonErr(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' }});
}

async function findAvatarIdByName(apiKey: string, name: string): Promise<string | null> {
  const r = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'Accept': 'application/json', 'X-Api-Key': apiKey },
  });
  const j = await r.json().catch(() => ({}));
  const list: any[] =
    (Array.isArray(j?.data) && j.data) ||
    (Array.isArray(j?.avatars?.avatars) && j.avatars.avatars) ||
    [];
  const match = list.find(a =>
    (a?.avatar_name || a?.name || a?.display_name || '').toLowerCase() === name.toLowerCase()
  );
  return match?.avatar_id || match?.id || null;
}
