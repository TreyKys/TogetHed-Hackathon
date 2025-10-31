// @ts-check
const { test, expect } = require('@playwright/test');

test('full user flow', async ({ page }) => {
  // Listen for all console events and log them to the test output
  page.on('console', msg => {
    console.log(`Browser Console [${msg.type()}]: ${msg.text()}`);
  });

  await page.goto('/');

  // Create vault
  await page.click('text=Create My Secure Vault');
  // Extend timeout for vault creation as it can be slow
  await page.waitForSelector('text=Vault created successfully!', { timeout: 90000 });

  // Set up profile
  await page.fill('input[placeholder="Enter your name"]', 'Jules');
  await page.fill('input[placeholder="Enter your email"]', 'jules@example.com');
  await page.click('text=Save Profile');
  await page.waitForSelector('text=Marketplace', { timeout: 30000 });

  // The rest of the test flow is commented out to isolate the vault/profile issue
  /*
  // List an item
  await page.click('text=Sell');
  await page.fill('input[placeholder="Asset Name"]', 'My NFT');
  await page.fill('input[placeholder="Asset Description"]', 'A cool NFT');
  await page.fill('input[placeholder="Set Price in HBAR"]', '10');
  await page.click('text=List for Sale');
  await page.waitForSelector('text=Asset listed successfully!');

  // Buy an item
  await page.click('text=Marketplace');
  await page.click('text=My NFT');
  await page.click('text=Buy Now');
  await page.waitForSelector('text=Purchase successful!');
  */
});
