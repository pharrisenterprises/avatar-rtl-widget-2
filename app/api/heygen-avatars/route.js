export const dynamic = 'force-dynamic';

export async function GET() {
  const id = process.env.HEYGEN_AVATAR_ID || '';
  return Response.json({ ok: true, id, source: id ? 'env_id' : 'missing', nameHint: '' });
}
