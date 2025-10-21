
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:5173")

        # Create a secure vault
        page.get_by_role("button", name="Create Your Secure Vault").click()
        page.wait_for_selector("text=⏳ Finalizing account on the network (approx. 5 seconds)...")
        page.wait_for_selector("text=✅ Secure vault created!")

        # Click the mint button
        page.get_by_role("button", name="1. Mint RWA NFT").click()
        page.wait_for_selector("text=✅ NFT Minted!")

        page.screenshot(path="jules-scratch/verification/verification.png")
        browser.close()

run()
