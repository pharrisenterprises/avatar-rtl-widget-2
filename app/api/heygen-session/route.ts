import { NextResponse } from 'next/server';

// Simple GET so /diagnostics can ping this route
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/heygen-session' });
}

// POST is what your Start button is calling
export async function POST() {
  // TODO: replace this stub with a real HeyGen session call.
  // For now we return a fake shape so your UI moves forward.
  // If you ALREADY have a HeyGen player URL you want to embed,
  // you can temporarily paste it below to prove the page works.
  const useTemporaryPlayerUrl = ''; // e.g. 'https://player.heygen.com/...?token=...'

  if (useTemporaryPlayerUrl) {
    return NextResponse.json({ player_url: useTemporaryPlayerUrl });
  }

  // No player_url yet—return keys so the UI shows "Got JSON without player_url"
  return NextResponse.json({
    ok: true,
    note: 'Stub response – add HeyGen API call here',
  });
}
