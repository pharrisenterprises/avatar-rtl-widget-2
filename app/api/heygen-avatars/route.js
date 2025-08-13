export const dynamic = 'force-dynamic';

export async function GET() {
  // Prefer explicit ID via env
  const byId = process.env.HEYGEN_AVATAR_ID?.trim();
  if (byId) return Response.json({ ok: true, id: byId, source: 'env_id', nameHint: '' });

  // Fallback: legacy name env (not recommended for streaming)
  const byName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME?.trim();
  if (byName) return Response.json({ ok: true, id: byName, source: 'env_name', nameHint: '' });

  return Response.json({ ok: false, error: 'no_avatar_id' }, { status: 404 });
}
