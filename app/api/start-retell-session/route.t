import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! });

export async function POST() {
  try {
    const session = await retell.sessions.create({
      agentId: process.env.RETELL_CHAT_AGENT_ID!, // Chat agent only
      startMuted: true // No audio plays to caller
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error starting Retell session:', error);
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
}
