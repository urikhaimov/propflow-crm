import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright-core'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const IS_LOCAL = process.env.NODE_ENV === 'development'

// Find Chrome/Chromium executable on the current OS
function findChromeExecutable(): string | null {
  if (process.platform === 'win32') {
    const candidates = [
      process.env.LOCALAPPDATA    && path.join(process.env.LOCALAPPDATA,    'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env.PROGRAMFILES    && path.join(process.env.PROGRAMFILES,    'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'] as string, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      // Edge as fallback
      process.env.PROGRAMFILES    && path.join(process.env.PROGRAMFILES,    'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      process.env.LOCALAPPDATA    && path.join(process.env.LOCALAPPDATA,    'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ].filter(Boolean) as string[]
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p } catch { /* continue */ }
    }
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ]
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p } catch { /* continue */ }
    }
  } else {
    // Linux
    for (const name of ['google-chrome', 'chromium-browser', 'chromium', 'microsoft-edge']) {
      try {
        const { execSync } = require('child_process')
        const p = execSync(`which ${name} 2>/dev/null`).toString().trim()
        if (p) return p
      } catch { /* continue */ }
    }
  }
  return null
}

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
  const { url, useProfile = false } = body as { url: string; useProfile?: boolean }

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  if (!IS_LOCAL) {
    return NextResponse.json(
      {
        error: 'local_only',
        message:
          'סריקת Playwright מחייבת הפעלה מקומית (npm run dev). ' +
          'בפריסת Vercel השתמש במקורות הרגילים (Reddit, יד2, טלגרם, מדלן).',
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

    if (useProfile) {
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

    return NextResponse.json({ text: text.substring(0, 8_000), title, url, isLocal: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    // Clean up temp profile dir
    if (tmpProfileDir) {
      try { fs.rmSync(tmpProfileDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
}
