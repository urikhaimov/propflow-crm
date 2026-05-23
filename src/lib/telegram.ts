// lib/telegram.ts
// Telegram Bot API wrapper

const BASE = 'https://api.telegram.org'

function botUrl(path: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')
  return `${BASE}/bot${token}/${path}`
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  try {
    const res = await fetch(botUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) {
      const err = await res.json()
      console.error('Telegram send error:', err)
    }
  } catch (e) {
    console.error('Telegram send failed:', e)
  }
}

export async function registerTelegramWebhook(webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const res = await fetch(botUrl('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret || undefined,
      allowed_updates: ['message'],
    }),
  })
  return res.json()
}

export async function getTelegramWebhookInfo(): Promise<{ url?: string; has_custom_certificate?: boolean; pending_update_count?: number }> {
  try {
    const res = await fetch(botUrl('getWebhookInfo'))
    const data = await res.json()
    return data.result || {}
  } catch {
    return {}
  }
}
