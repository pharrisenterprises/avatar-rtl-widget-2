import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';

export async function POST() {
  try {
    const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });
    const agentId = process.env.RETELL_CHAT_AGENT_ID!;
    const chat = await client.chat.create({ agent_id: agentId });
    return NextResponse.json({ chat_id: chat.chat_id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'retell start failed' }, { status: 500 });
  }
}
