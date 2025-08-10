import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';

export async function POST(req: Request) {
  try {
    const { chat_id, content } = await req.json();
    if (!chat_id || !content) return NextResponse.json({ error: 'chat_id and content required' }, { status: 400 });

    const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });
    const resp = await client.chat.createChatCompletion({ chat_id, content });

    // Extract first agent message text
    const text = resp?.messages?.[0]?.content || '';
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'retell send failed' }, { status: 500 });
  }
}
