// app/api/integrations/status/route.ts
// Returns which inbound channels are configured (reads env server-side)
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    capture_form: true,
    whatsapp: !!(
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_VERIFY_TOKEN
    ),
    facebook: !!(
      process.env.FACEBOOK_PAGE_ACCESS_TOKEN &&
      process.env.FACEBOOK_VERIFY_TOKEN
    ),
    telegram: !!process.env.TELEGRAM_BOT_TOKEN,
    app_url: process.env.NEXT_PUBLIC_APP_URL || '',
  })
}
