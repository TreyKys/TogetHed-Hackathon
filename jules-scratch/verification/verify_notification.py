
import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Login as a new user
        await page.goto("http://localhost:5173/")
        await page.evaluate("() => localStorage.clear()")
        await page.evaluate("() => localStorage.setItem('integro-private-key', '0x0000000000000000000000000000000000000000000000000000000000000003')")
        await page.evaluate("() => localStorage.setItem('integro-account-id', '0.0.654321')")
        await page.evaluate("() => localStorage.setItem('integro-evm-address', '0x0000000000000000000000000000000000000003')")

        # Navigate to the marketplace
        await page.goto("http://localhost:5173/marketplace")

        # Wait for the toast notification to appear
        await expect(page.locator(".toast-notification")).to_be_visible()
        await expect(page.get_by_text("Please complete your profile to create listings.")).to_be_visible()

        # Take a screenshot of the page with the notification
        await page.screenshot(path="jules-scratch/verification/verification.png")

        await browser.close()

asyncio.run(main())
