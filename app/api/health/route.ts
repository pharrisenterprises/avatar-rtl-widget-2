// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const hasKey     = !!process.env.HEYGEN_API_KEY;
  const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';
  const voiceId    = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';

  // We support the name+voice path (your current setup).
  // If you ever add HEYGEN_AVATAR_ID later, this still stays valid.
  const avatarId   = process.env.HEYGEN_AVATAR_ID || '';

  const ok = hasKey && (!!avatarName || !!avatarId) && !!voiceId;

  return NextResponse.json({
    ok,
    hasKey,
    using: avatarId ? 'id' : 'name',
    avatarId: avatarId ? 'set' : 'missing',
    avatarName: avatarName ? 'set' : 'missing',
    voiceId: voiceId ? 'set' : 'missing',
  });
}
