export const dynamic = 'force-dynamic';
export async function GET() {
  const hasHG = !!process.env.HEYGEN_API_KEY;
  const hasID = !!process.env.HEYGEN_AVATAR_ID;
  const hasRT = !!process.env.RETELL_API_KEY;
  const hasAG = !!(process.env.RETELL_CHAT_AGENT_ID || process.env.RETELL_AGENT_ID);
  return Response.json({
    ok: hasHG && hasID && hasRT && hasAG,
    hasHeyGenKey: hasHG,
    hasAvatarId: hasID,
    hasRetellKey: hasRT,
    hasRetellAgent: hasAG,
  });
}
