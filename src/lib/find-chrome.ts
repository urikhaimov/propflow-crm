// lib/find-chrome.ts — locates a local Chrome/Edge executable for headless
// browser automation in local dev (Vercel uses @sparticuz/chromium instead).
import * as fs from 'fs'
import * as path from 'path'

export function findChromeExecutable(): string | null {
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
