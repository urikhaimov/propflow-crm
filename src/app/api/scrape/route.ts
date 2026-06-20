import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright-core'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { findChromeExecutable } from '@/lib/find-chrome'

const IS_LOCAL = process.env.NODE_ENV === 'development'

// Chrome profile dir for scraping.
// Prefers a "PropFlow" named profile so it never conflicts with the user's running Chrome.
// Falls back to the default Chrome user data dir.
function getChromeProfileDir(): string {
  const base = process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'Google', 'Chrome', 'User Data')
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
      : path.join(os.homedir(), '.config', 'google-chrome')

  // If a dedicated PropFlow scraper profile exists, use it (won't conflict with running Chrome)
  const propflowProfile = path.join(base, 'PropFlow')
  if (fs.existsSync(propflowProfile)) return propflowProfile

  return base
}

// Create a temp copy of the Chrome profile so we don't conflict with a running Chrome instance.
// Only copies cookies and local storage — fast and avoids the "profile locked" error.
function makeTempProfile(sourceDir: string): string {
  const tmpDir = path.join(os.tmpdir(), `propflow-chrome-${Date.now()}`)
  const defaultSrc = path.join(sourceDir, 'Default')
  const defaultDst = path.join(tmpDir, 'Default')
  fs.mkdirSync(defaultDst, { recursive: true })

  // Copy only the files that carry session state
  const filesToCopy = ['Cookies', 'Local Storage', 'Session Storage', 'IndexedDB']
  for (const name of filesToCopy) {
    const src = path.join(defaultSrc, name)
    const dst = path.join(defaultDst, name)
    try {
      const stat = fs.statSync(src)
      if (stat.isDirectory()) {
        fs.cpSync(src, dst, { recursive: true })
      } else {
        fs.copyFileSync(src, dst)
      }
    } catch { /* file may not exist */ }
  }
  return tmpDir
}

// GET — lets the client know if Playwright is available
export async function GET() {
  const execPath = findChromeExecutable()
  return NextResponse.json({ isLocal: IS_LOCAL, chromePath: execPath })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { url, useProfile = false, headful = false } = body as { url: string; useProfile?: boolean; headful?: boolean }

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  if (!IS_LOCAL) {
    return NextResponse.json(
      {
        error: 'local_only',
        message:
          'סריקת Playwright מחייבת הפעלה מקומית (npm run dev). ' +
          'בפריסת Vercel השתמש במקורות הרגילים (טלגרם, הדבקה ידנית).',
      },
      { status: 403 }
    )
  }

  const execPath = findChromeExecutable()
  if (!execPath) {
    return NextResponse.json(
      { error: 'chrome_not_found', message: 'לא נמצא Chrome או Edge במחשב. התקן Google Chrome ונסה שוב.' },
      { status: 500 }
    )
  }

  let tmpProfileDir: string | null = null

  try {
    let text = ''
    let title = ''
    let nextData = ''

    if (headful) {
      // Visible real Chrome — best shot at passing aggressive bot detection
      // (e.g. Madlan's PerimeterX) that flags headless browsers. Uses a
      // dedicated persistent profile so a manually-solved CAPTCHA (and its
      // cookie) survives across runs. Never conflicts with the user's own
      // Chrome since it's a separate user-data dir.
      const profileDir = path.join(os.homedir(), '.propflow-scraper-profile')
      fs.mkdirSync(profileDir, { recursive: true })

      const context = await chromium.launchPersistentContext(profileDir, {
        executablePath: execPath,
        headless: false,
        viewport: { width: 1280, height: 900 },
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--no-default-browser-check',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      })
      try {
        const page = context.pages()[0] || await context.newPage()
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        // Poll until the page is real content rather than a bot-challenge,
        // leaving time for the user to solve a CAPTCHA in the visible window.
        try {
          await page.waitForFunction(() => {
            const t = document.body?.innerText || ''
            const challenged = /רובוט|captcha|are you a robot|הפרעה|access denied/i.test(t)
            return !challenged && t.length > 500
          }, { timeout: 120_000, polling: 1_000 })
        } catch { /* timed out — return whatever rendered */ }
        text = await page.evaluate(() => document.body.innerText)
        title = await page.title()
        // For SPA listing sites (Madlan), the structured data is in __NEXT_DATA__,
        // not innerText. Surface it so the caller can parse real listings.
        nextData = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent || '')
      } finally {
        await context.close()
      }
    } else if (useProfile) {
      // Copy session data to a temp dir so we don't conflict with running Chrome
      const sourceProfile = getChromeProfileDir()
      tmpProfileDir = makeTempProfile(sourceProfile)

      const context = await chromium.launchPersistentContext(tmpProfileDir, {
        executablePath: execPath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      })
      try {
        const page = await context.newPage()
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
        await page.waitForTimeout(2_000)
        text = await page.evaluate(() => document.body.innerText)
        title = await page.title()
      } finally {
        await context.close()
      }
    } else {
      const browser = await chromium.launch({
        executablePath: execPath,
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-first-run'],
      })
      try {
        const page = await browser.newPage()
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        await page.waitForTimeout(1_500)
        text = await page.evaluate(() => document.body.innerText)
        title = await page.title()
      } finally {
        await browser.close()
      }
    }

    return NextResponse.json({ text: text.substring(0, 8_000), title, url, isLocal: true, nextData: nextData.substring(0, 1_000_000) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    // Clean up temp profile dir
    if (tmpProfileDir) {
      try { fs.rmSync(tmpProfileDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
}
