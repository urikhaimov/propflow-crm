import { NextResponse } from 'next/server'
import { chromium } from 'playwright-core'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { findChromeExecutable } from '@/lib/find-chrome'

const IS_LOCAL = process.env.NODE_ENV === 'development'

// Headful login wait + 6 group navigations can take a while.
export const maxDuration = 120

// Known Israeli real estate Facebook groups
const FB_GROUPS = [
  { url: 'https://www.facebook.com/groups/nadlan.israel/',         label: 'נדלן ישראל' },
  { url: 'https://www.facebook.com/groups/israelirealestate/',     label: 'Israel Real Estate' },
  { url: 'https://www.facebook.com/groups/apartment.israel/',      label: 'דירות בישראל' },
  { url: 'https://www.facebook.com/groups/telavivrealestate/',     label: 'תל אביב נדלן' },
  { url: 'https://www.facebook.com/groups/realestate.tlv/',        label: 'נדלן TLV' },
  { url: 'https://www.facebook.com/groups/israelnachlas/',         label: 'ישראל נחלאות' },
]

type Post = { title: string; body: string; url: string }

// Language-independent "is this a login wall?" — a visible password field or a
// /login URL means we're not authenticated (works for FB in any UI language).
function loginCheck() {
  return !!document.querySelector('input[type="password"], input[name="pass"]')
}

export async function GET() {
  if (!IS_LOCAL) {
    return NextResponse.json({
      source: 'facebook', count: 0, posts: [], localOnly: true,
      debug: [
        'Facebook scraping requires a local run (npm run dev) with a visible browser.',
        'On Vercel the browser runs on their servers — it can never be logged into your Facebook.',
      ],
    })
  }

  const execPath = findChromeExecutable()
  if (!execPath) {
    return NextResponse.json(
      { source: 'facebook', count: 0, posts: [], debug: ['לא נמצא Chrome/Edge במחשב. התקן Google Chrome ונסה שוב.'] },
      { status: 200 },
    )
  }

  // Dedicated persistent profile: a Facebook login solved here survives across
  // runs. Separate from your everyday Chrome, so it never conflicts / locks.
  const profileDir = path.join(os.homedir(), '.propflow-scraper-profile')
  fs.mkdirSync(profileDir, { recursive: true })

  const posts: Post[] = []
  const seen = new Set<string>()
  const debug: string[] = []

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: execPath,
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
    ignoreDefaultArgs: ['--enable-automation'],
  })

  try {
    const page = context.pages()[0] || await context.newPage()

    // 1) Ensure we're logged in. If not, wait (up to ~2.5 min) for the user to
    //    log into Facebook in the visible window. The session then persists.
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
    let loggedIn = !(await page.evaluate(loginCheck).catch(() => true))
    if (!loggedIn) {
      debug.push('facebook: not logged in — log into Facebook in the open window…')
      for (let i = 0; i < 75; i++) {
        await page.waitForTimeout(2_000)
        loggedIn = !(await page.evaluate(loginCheck).catch(() => true))
        if (loggedIn) break
      }
    }
    if (!loggedIn) {
      debug.push('facebook: still not logged in after waiting. Log in, then run the scan again.')
      return NextResponse.json({ source: 'facebook', count: 0, posts, debug })
    }
    debug.push('facebook: logged in ✓')

    // 2) Walk each group, scroll to load posts, extract visible text paragraphs.
    for (const group of FB_GROUPS) {
      try {
        await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
        await page.waitForTimeout(3_500)
        for (let s = 0; s < 3; s++) {
          await page.evaluate(() => window.scrollBy(0, 2200))
          await page.waitForTimeout(1_500)
        }

        if (page.url().includes('/login') || (await page.evaluate(loginCheck).catch(() => false))) {
          debug.push(`${group.label}: login wall (group may be private / not joined)`)
          continue
        }

        const text = await page.evaluate(() => document.body.innerText)
        const paragraphs = text
          .split(/\n{2,}/)
          .map(p => p.trim())
          .filter(p => p.length > 40 && p.length < 2_000)
          .slice(0, 25)

        let added = 0
        for (const para of paragraphs) {
          const fp = para.substring(0, 60)
          if (seen.has(fp)) continue
          seen.add(fp)
          posts.push({
            title: para.split('\n')[0].substring(0, 120),
            body: `[פייסבוק — ${group.label}] ${para.substring(0, 600)}`,
            url: group.url,
          })
          added++
        }
        debug.push(`${group.label}: ${added} posts extracted`)
      } catch (err) {
        debug.push(`${group.label}: error — ${String(err).substring(0, 80)}`)
      }
    }
  } finally {
    await context.close()
  }

  if (posts.length === 0) {
    debug.push('facebook: 0 posts — groups may be private/unjoined, or FB rendered no readable text.')
  }
  return NextResponse.json({ source: 'facebook', count: posts.length, posts, debug })
}
