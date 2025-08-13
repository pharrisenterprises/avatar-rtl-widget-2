export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiKey = process.env.RETELL_API_KEY || '';
    const agentId = process.env.RETELL_CHAT_AGENT_ID || process.env.RETELL_AGENT_ID || '';
    if (!apiKey || !agentId) {
      return Response.json({ ok: false, error: 'Missing RETELL_API_KEY or RETELL_CHAT_AGENT_ID' }, { status: 500 });
    }

    // Start a chat session for this agent
    const r = await fetch(`https://api.retellai.com/v2/chat/start?agent_id=${encodeURIComponent(agentId)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) return Response.json({ ok: false, status: r.status, body: j }, { status: r.status });

    // normalize a couple of common shapes
    const chatId = j?.chat_id || j?.id || j?.data?.chat_id || j?.data?.id || null;
    return Response.json({ ok: true, raw: j, chatId });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || 'start failed' }, { status: 500 });
  }
}
