// /app/api/heygen-session/route.ts
export const runtime = 'nodejs'; // safer for fetch + env

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: 'heygen-session' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Creates a new Streaming session (LiveKit) and returns access_token + urls
export async function POST(request: Request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'missing_env',
      detail: { HEYGEN_API_KEY: false }
    }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  const body = await request.json().catch(() => ({}));
  const { avatarId, quality, voiceId } = body as {
    avatarId?: string;
    quality?: 'high' | 'medium' | 'low';
    voiceId?: string;
  };

  try {
    const r = await fetch('https://api.heygen.com/v1/streaming.new', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quality: quality || 'high',
        ...(avatarId ? { avatar_id: avatarId } : {}),
        ...(voiceId ? { voice: { voice_id: voiceId } } : {}),
        // You can add other fields later (knowledge_base, stt_settings, etc.)
      }),
    });

    const text = await r.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    if (!r.ok) {
      return new Response(JSON.stringify({
        error: 'heygen_fail',
        status: r.status,
        headers: Object.fromEntries(r.headers),
        detail_text: text,
        parsed_json: json
      }), { status: 500, headers: { 'Content-Type': 'application/json' }});
    }

    // Docs say response includes data.session_id, data.access_token, data.url, etc.
    // We'll just return whatever JSON HeyGen sent.
    return new Response(JSON.stringify(json ?? { raw: text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      error: 'heygen_exception',
      detail: String(err?.message || err)
    }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
}
