export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const apiKey = process.env.RETELL_API_KEY || '';
    if (!apiKey) return Response.json({ ok: false, error: 'Missing RETELL_API_KEY' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const chatId = body?.chatId || body?.id;
    const text = (body?.text || '').trim();

    if (!chatId || !text) {
      return Response.json({ ok: false, error: 'Missing chatId or text' }, { status: 400 });
    }

    // Send a user message
    const r = await fetch(`https://api.retellai.com/v2/chat/${encodeURIComponent(chatId)}/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'user', content: text }),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) return Response.json({ ok: false, status: r.status, body: j }, { status: r.status });

    // normalize: find assistant reply text
    let reply = '';
    if (j?.messages) {
      const last = [...j.messages].reverse().find(m => (m.role === 'assistant' || m.role === 'model'));
      reply = last?.text || last?.content || '';
    } else if (j?.message) {
      reply = j.message?.text || j.message?.content || '';
    } else if (j?.text) {
      reply = j.text;
    }

    return Response.json({ ok: true, raw: j, reply });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || 'send failed' }, { status: 500 });
  }
}
