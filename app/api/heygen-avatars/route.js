// /app/api/heygen-avatars/route.js
export async function GET() {
  const id = process.env.HEYGEN_AVATAR_ID || '';
  return new Response(JSON.stringify({ id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
