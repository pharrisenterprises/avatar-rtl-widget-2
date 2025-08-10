import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { text } = await req.json();

  const res = await fetch("https://api.heygen.com/v1/video/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": process.env.HEYGEN_API_KEY!,
    },
    body: JSON.stringify({
      avatar_name: process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME!,
      voice_id: process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID!,
      text
    })
  });

  const data = await res.json();
  return NextResponse.json(data);
}
