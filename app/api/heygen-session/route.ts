// /app/api/heygen-session/route.ts
export const runtime = 'edge';

// Health check (GET)
export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: 'heygen-session' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request) {
  const { avatarId, voiceId } = await request.json().catch(() => ({}));

  const r = await fetch('https://api.heygen.com/v1/streaming.create_session', {
    method: 'POST',
    headers: {
      'X-Api-Key': process.env.HEYGEN_API_KEY as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      avatar_id: avatarId || 'default-avatar-1',
      voice_id:  voiceId  || 'default-voice-1'
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    return new Response(JSON.stringify({ error: 'heygen_fail', detail: txt }), { status: 500 });
  }

  const data = await r.json();
  return new Response(JSON.stringify(data), { status: 200 });
}
