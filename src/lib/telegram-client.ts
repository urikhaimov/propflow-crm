// Telegram MTProto client (GramJS) — reads public channel history with a user
// account session, which (unlike the Bot API) can fetch messages from channels
// you haven't joined. Unlike the t.me/s/ HTML preview, MTProto is NOT
// IP-blocked, so it works from Vercel's datacenter IPs.
//
// Setup (one-time): run `npm run telegram:login` to generate TELEGRAM_SESSION,
// then add TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION to the env.
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'

let cached: TelegramClient | null = null

/** True when all three MTProto env vars are present. */
export function telegramConfigured(): boolean {
  return !!(
    process.env.TELEGRAM_API_ID &&
    process.env.TELEGRAM_API_HASH &&
    process.env.TELEGRAM_SESSION
  )
}

/**
 * Returns a connected TelegramClient. Reuses a module-level instance while the
 * serverless function stays warm, so repeated calls don't re-handshake.
 */
export async function getTelegramClient(): Promise<TelegramClient> {
  const apiId = Number(process.env.TELEGRAM_API_ID)
  const apiHash = process.env.TELEGRAM_API_HASH || ''
  const session = process.env.TELEGRAM_SESSION || ''

  if (!apiId || !apiHash || !session) {
    throw new Error('Telegram MTProto not configured (set TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION)')
  }

  if (cached?.connected) return cached

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
  })
  // Silence GramJS's verbose console output in server logs.
  try { (client as { setLogLevel: (l: string) => void }).setLogLevel('none') } catch {}

  await client.connect()
  cached = client
  return client
}
