export const runtime = 'edge';

export async function GET() {
  return Response.json({ ok: true, route: 'retell-token' });
}

export async function POST() {
  try {
    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing RETELL_API_KEY' }), { status: 500 });
    }

    const res = await fetch('https://api.retellai.com/v2/some-endpoint', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ /* whatever payload Retell expects */ }),
    });

    const data = await res.json();
    return Response.json(data);
  } catch (err:any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
