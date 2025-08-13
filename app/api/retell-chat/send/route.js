// app/api/retell-chat/send/route.js
export async function POST(req) {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing RETELL_API_KEY' }), { status: 500 });
  }

  try {
    const { chatId, text } = await req.json().catch(() => ({}));
    if (!chatId || !text) {
      return new Response(JSON.stringify({ ok: false, error: 'chatId and text are required' }), { status: 400 });
    }

    const r = await fetch('https://api.retellai.com/v2/chat/send_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    const j = await r.json();
    // Normalize the reply field
    const reply =
      j.reply ||
      j.message ||
      (Array.isArray(j.messages) ? (j.messages[0]?.text || j.messages[0]?.content || null) : null) ||
      j.content || null;

    return new Response(JSON.stringify({ ok: r.ok, reply, raw: j }), { status: r.ok ? 200 : 400 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'retell send failed' }), { status: 500 });
  }
}
