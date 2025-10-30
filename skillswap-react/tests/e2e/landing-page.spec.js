import { test, expect } from '@playwright/test';

test('Landing Page', async ({ page }) => {
  await page.goto('http://localhost:8000');
  await page.screenshot({ path: 'landing-page.png', fullPage: true });
});
