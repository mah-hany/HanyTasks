import puppeteer from 'puppeteer-core';
import fs from 'fs';

function getChromeExecutablePath() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const paths = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // Mac
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Linux / Render
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome executable not found. Please set CHROME_BIN environment variable.');
}

export const generatePdf = async (html: string, options?: { landscape?: boolean; margin?: any }) => {
  const browser = await puppeteer.launch({
    executablePath: getChromeExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  
  // Set HTML content
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  // Generate PDF
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    landscape: options?.landscape || false,
    margin: options?.margin || { top: '20px', bottom: '20px', left: '20px', right: '20px' },
  });
  
  await browser.close();
  // Return Uint8Array since Puppeteer ^23 returns Uint8Array, we convert to Buffer
  return Buffer.from(pdfBuffer);
};
