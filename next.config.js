/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    'playwright-core',
    'puppeteer-core',
    '@sparticuz/chromium-min',
  ],
}

module.exports = nextConfig