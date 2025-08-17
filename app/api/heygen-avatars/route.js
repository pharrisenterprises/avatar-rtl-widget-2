// /app/api/heygen-avatars/route.js
// Returns the avatar *ID* straight from your Vercel env var: HEYGEN_AVATAR_ID

export async function GET() {
  const id = process.env.HEYGEN_AVATAR_ID || '';
  return new Response(
    JSON.stringify({ id }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
