import { NextRequest, NextResponse } from "next/server";

// Optional cloud TTS. Off unless OPENAI_API_KEY is set on the server. The client falls back to
// browser speech silently, so a failure here never blocks the demo.
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Cloud TTS not configured" }, { status: 501 });
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text || text.length > 2000) return NextResponse.json({ error: "Text is required" }, { status: 400 });
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || "tts-1", input: text, voice: "alloy" }),
    });
    if (!res.ok) return NextResponse.json({ error: "TTS provider error" }, { status: 502 });
    const audio = await res.arrayBuffer();
    return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg" } });
  } catch {
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}
