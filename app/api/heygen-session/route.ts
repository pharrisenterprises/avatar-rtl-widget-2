export const runtime = 'edge';

export async function GET() {
  return Response.json({ ok: true, route: 'heygen-session' });
}

export async function POST(request: Request) {
  try {
    const { avatarId, voiceId } = await request.json();
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing HEYGEN_API_KEY' }), { status: 500 });
    }

    const res = await fetch('https://api.heygen.com/v1/some-endpoint', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar_id: avatarId,
        voice_id: voiceId,
      }),
    });

    const data = await res.json();
    return Response.json(data);
  } catch (err:any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
