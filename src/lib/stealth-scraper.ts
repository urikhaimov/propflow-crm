// lib/stealth-scraper.ts — free headless-browser fallback for Yad2/Madlan
// when plain HTTP is blocked. Uses puppeteer-extra + the stealth plugin to
// reduce automation fingerprints, with @sparticuz/chromium for serverless
// (Vercel) compatibility.
//
// No guarantee against sophisticated bot detection (e.g. Cloudflare Managed
// Challenge / Turnstile) — this is a free attempt tried before falling back
// to Apify, not a replacement for it.

import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser } from 'puppeteer-core'
import { findChromeExecutable } from '@/lib/find-chrome'

puppeteer.use(StealthPlugin())

const IS_VERCEL = !!process.env.VERCEL
const NAV_TIMEOUT_MS = 25_000

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Launches a (stealth-patched) headless browser, sized for serverless cold starts. */
async function launchBrowser(): Promise<Browser> {
  if (IS_VERCEL) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    }) as unknown as Promise<Browser>
  }
  // Local dev — puppeteer-core has no bundled browser, point it at system Chrome/Edge.
  const executablePath = findChromeExecutable()
  if (!executablePath) throw new Error('No local Chrome/Edge found for stealth scraper')
  return puppeteer.launch({ executablePath, headless: true }) as unknown as Promise<Browser>
}

/**
 * Loads a URL in a stealth headless browser and returns the rendered HTML.
 * Throws on navigation failure or timeout — callers should catch and fall
 * back to their next option (e.g. Apify).
 */
export async function scrapeStealthHtml(url: string, waitForSelector?: string): Promise<string> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    )
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8' })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 8_000 }).catch(() => {})
    } else {
      await sleep(2_000)
    }

    return await page.content()
  } finally {
    await browser.close().catch(() => {})
  }
}
