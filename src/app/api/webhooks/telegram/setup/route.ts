// app/api/webhooks/telegram/setup/route.ts
// Registers (or checks) the Telegram webhook URL with the Bot API.
// Called from the Settings page "Register Webhook" button.
import { NextRequest, NextResponse } from 'next/server'
import { registerTelegramWebhook, getTelegramWebhookInfo } from '@/lib/telegram'

// GET — return current webhook status
export async function GET() {
  try {
    const info = await getTelegramWebhookInfo()
    return NextResponse.json({ ok: true, webhook: info })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}

// POST — register the webhook
export async function POST(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return NextResponse.json({ ok: false, error: 'NEXT_PUBLIC_APP_URL not set' }, { status: 500 })
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })
  }

  const webhookUrl = `${appUrl}/api/webhooks/telegram`
  const result = await registerTelegramWebhook(webhookUrl)
  return NextResponse.json({ ...result, webhookUrl })
}
