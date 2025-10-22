
import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5173/")

        # Create a secure vault
        page.get_by_role("button", name="Create Your Secure Vault").click()
        expect(page.locator(".status-message")).to_contain_text("✅ Secure vault created!", timeout=20000)

        # Mint an NFT
        page.get_by_role("button", name="1. Mint RWA NFT").click()
        expect(page.locator(".status-message")).to_contain_text("✅ Ready to List!", timeout=45000) # Increased timeout for polling

        # List the NFT
        page.get_by_role("button", name="2. List NFT for 50 HBAR").click()
        expect(page.locator(".status-message")).to_contain_text("✅ NFT Listed for 50 HBAR!", timeout=20000)

        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
