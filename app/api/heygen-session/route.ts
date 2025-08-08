// /app/api/heygen-session/route.ts
export const runtime = 'edge';

// Health check (GET)
export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: 'heygen-session' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Create a HeyGen streaming session (POST)
export async function POST(request: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'missing_env', detail: 'HEYGEN_API_KEY not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { avatarId, voiceId } = await request.json().catch(() => ({}));

    const r = await fetch('https://api.heygen.com/v1/streaming.create_session', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar_id: avatarId || 'default-avatar-1',
        voice_id:  voiceId  || 'default-voice-1',
      }),
    });

    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }

    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: 'heygen_fail', status: r.status, detail: text }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'heygen_exception', detail: String(err?.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
