// One-time Telegram MTProto login — generates a TELEGRAM_SESSION string.
//
// Usage:
//   1. Get api_id + api_hash from https://my.telegram.org → "API development tools"
//   2. Run:  npm run telegram:login
//   3. Enter your phone, the login code Telegram sends you, and (if set) your
//      2FA password.
//   4. Copy the printed TELEGRAM_SESSION=... line into .env.local (and Vercel
//      env vars), alongside TELEGRAM_API_ID and TELEGRAM_API_HASH.
//
// The session string grants access to your Telegram account — keep it secret.
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const rl = readline.createInterface({ input, output })
const ask = (q) => rl.question(q)

const apiId = Number(process.env.TELEGRAM_API_ID || (await ask('TELEGRAM_API_ID (from my.telegram.org): ')))
const apiHash = process.env.TELEGRAM_API_HASH || (await ask('TELEGRAM_API_HASH: '))

if (!apiId || !apiHash) {
  console.error('\n❌ api_id and api_hash are required. Get them at https://my.telegram.org')
  process.exit(1)
}

const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
  connectionRetries: 5,
})

await client.start({
  phoneNumber: async () => await ask('Phone number (e.g. +9725...): '),
  password: async () => await ask('2FA password (leave blank if none): '),
  phoneCode: async () => await ask('Login code (sent to you in Telegram): '),
  onError: (err) => console.error('Login error:', err?.message || err),
})

console.log('\n✅ Logged in successfully. Add this line to .env.local AND your Vercel env vars:\n')
console.log('TELEGRAM_SESSION=' + client.session.save())
console.log('\n⚠️  Keep it secret — it grants full access to your Telegram account.\n')

await client.disconnect()
rl.close()
process.exit(0)
