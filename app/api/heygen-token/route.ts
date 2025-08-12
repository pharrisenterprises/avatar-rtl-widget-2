// app/api/heygen-token/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'Missing HEYGEN_API_KEY' }, { status: 500 });
  }
  // Health-style visibility only
  return NextResponse.json({ ok: true, keyPresent: apiKey.slice(0, 6) + '…' });
}
