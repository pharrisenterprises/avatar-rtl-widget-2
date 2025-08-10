import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';

export async function POST(req: Request) {
  try {
    const { chat_id, content } = await req.json();
    if (!chat_id || !content) {
      return NextResponse.json({ error: 'chat_id and content required' }, { status: 400 });
    }

    const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });

    // v4 SDK returns a union; treat as any and pick the first assistant-like text
    const resp: any = await client.chat.createChatCompletion({ chat_id, content });

    let text = '';
    const msgs: any[] = Array.isArray(resp?.messages) ? resp.messages : [];

    if (msgs.length) {
      // Prefer the first assistant/agent message with string content
      const firstAssistant = msgs.find(
        (m: any) =>
          (m?.role === 'assistant' || m?.role === 'agent') &&
          typeof m?.content === 'string' &&
          m.content.trim()
      );
      if (firstAssistant) {
        text = firstAssistant.content;
      } else if (typeof msgs[0]?.content === 'string') {
        text = msgs[0].content; // fallback to first message's content
      }
    } else if (typeof resp?.content === 'string') {
      // Some responses may have a top-level content
      text = resp.content;
    }

    return NextResponse.json({ text: text || '' });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'retell send failed' },
      { status: 500 }
    );
  }
}
