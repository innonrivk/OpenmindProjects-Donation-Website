const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];

  // Capture all console errors and warnings
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      // Ignore some known noisy logs
      if (text.includes('Stripe.js integration over HTTP') || text.includes('[GSI_LOGGER]')) {
        return;
      }
      logs.push(`- **[${msg.type().toUpperCase()}]**: ${text} (Location: ${msg.location().url})`);
    }
  });

  page.on('pageerror', exception => {
    logs.push(`- **[UNCAUGHT EXCEPTION]**: ${exception.message}`);
  });

  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/admin/login');

  console.log('Logging in...');
  await page.fill('input[type="email"]', 'admin@openmindprojects.org');
  await page.fill('input[type="password"]', '12345678');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/admin/dashboard**');
  console.log('Logged in successfully!');

  // Define tabs to test based on sidebar links
  const tabsToTest = [
    '/admin/dashboard',
    '/admin/dashboard/content',
    '/admin/dashboard/users',
    '/admin/dashboard/projects',
    '/admin/dashboard/tiers',
    '/admin/dashboard/ledger',
    '/admin/dashboard/comms',
    '/admin/dashboard/settings'
  ];

  for (const url of tabsToTest) {
    console.log(`Testing tab: ${url}...`);
    await page.goto(`http://localhost:5173${url}`, { waitUntil: 'networkidle' });
    // Wait an extra second to allow any async rendering/fetching to error if it will
    await page.waitForTimeout(1000);
  }

  await browser.close();

  // Format the output
  let markdown = '# Admin Dashboard QA Report\n\n';
  if (logs.length === 0) {
    markdown += '✅ **All tabs tested successfully.** No errors or warnings found!\n';
  } else {
    markdown += '⚠️ **The following console errors and warnings were detected:**\n\n';
    markdown += logs.join('\n');
  }

  // Find artifact directory and save it
  const artifactPath = path.join(process.env.APPDATA || process.env.HOME || '', '.gemini/antigravity-ide/brain/a47cd5e5-ad0e-4d3b-ac5c-6e2505677e2c/admin_dashboard_qa_report.md');
  
  // Write locally just in case
  fs.writeFileSync('admin_dashboard_qa_report.md', markdown);
  
  // Also print to console
  console.log(markdown);
  console.log('Done!');
})();
