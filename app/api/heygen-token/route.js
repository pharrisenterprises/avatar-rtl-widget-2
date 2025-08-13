// app/api/heygen-token/route.js
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const key = process.env.HEYGEN_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_HEYGEN_API_KEY' }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }

    const upstream = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': key
      },
      body: JSON.stringify({}) // empty body; endpoint just mints a session token
    });

    const raw = await upstream.text(); // safely read either JSON or error text
    if (!upstream.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: upstream.status,
          body: raw.slice(0, 400) // show a snippet so we can diagnose
        }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      );
    }

    // API can return { data: { token } } or { token }
    let token = null;
    try {
      const j = JSON.parse(raw);
      token = j?.data?.token || j?.token || null;
    } catch {
      // not JSON? leave token as null → handled below
    }

    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, status: upstream.status, body: raw.slice(0, 400), hint: 'no token in response' }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, token }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 502,
      headers: { 'content-type': 'application/json' }
    });
  }
}
