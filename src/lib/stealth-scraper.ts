// lib/stealth-scraper.ts — free headless-browser fallback for Yad2/Madlan
// when plain HTTP is blocked. Hand-rolled stealth patches (not the
// puppeteer-extra-plugin-stealth package — its deep CJS dependency chain
// (clone-deep/merge-deep/is-plain-object) breaks both Turbopack's bundler
// and Vercel's serverless file-tracer depending on how it's configured).
// Patches cover the handful of signals headless Chrome trips that the real
// Chrome doesn't: navigator.webdriver, empty plugins/mimeTypes, missing
// window.chrome.runtime, and the permissions API's notification quirk.
//
// No guarantee against sophisticated bot detection (e.g. Cloudflare Managed
// Challenge / PerimeterX) — this is a free attempt tried before falling back
// to Apify, not a replacement for it.

import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import type { Browser, Page } from 'puppeteer-core'
import { findChromeExecutable } from '@/lib/find-chrome'

const IS_VERCEL = !!process.env.VERCEL
const NAV_TIMEOUT_MS = 25_000

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function launchBrowser(): Promise<Browser> {
  if (IS_VERCEL) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
  // Local dev — puppeteer-core has no bundled browser, point it at system Chrome/Edge.
  const executablePath = findChromeExecutable()
  if (!executablePath) throw new Error('No local Chrome/Edge found for stealth scraper')
  return puppeteer.launch({ executablePath, headless: true })
}

/** Patches the well-known headless-Chrome detection signals before any page script runs. */
async function applyStealthPatches(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
    Object.defineProperty(navigator, 'languages', { get: () => ['he-IL', 'he', 'en-US', 'en'] })
    // @ts-expect-error — window.chrome doesn't exist on headless Chrome by default
    window.chrome = { runtime: {} }
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (params: PermissionDescriptor) =>
      params.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(params)
  })
}

/**
 * Loads a URL in a stealth-patched headless browser and returns the rendered HTML.
 * Throws on navigation failure or timeout — callers should catch and fall
 * back to their next option (e.g. Apify).
 */
export async function scrapeStealthHtml(url: string, waitForSelector?: string): Promise<string> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await applyStealthPatches(page)
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
