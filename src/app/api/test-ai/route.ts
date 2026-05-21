// app/api/test-ai/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not found in env' })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Reply with only: {"ok": true}' }],
      }),
    })
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      response: text,
      error: data.error,
      keyPrefix: apiKey.substring(0, 15) + '...',
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
