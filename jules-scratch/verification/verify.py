
import time
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Increase timeout to 120 seconds for all actions
    page.set_default_timeout(120000)

    # Capture and print console logs
    page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

    try:
        print("Navigating to the application...")
        page.goto("http://localhost:5173")

        # 1. Create Vault
        print("Creating vault...")
        page.get_by_role("button", name="Create Your Secure Vault").click()
        expect(page.locator(".status-message")).to_contain_text("Secure vault created!", timeout=60000)
        print("Vault created.")

        # 2. Mint Token
        print("Minting token...")
        page.get_by_role("button", name="1. Mint RWA NFT").click()
        expect(page.locator(".status-message")).to_contain_text("Ownership Confirmed!", timeout=120000) # Increased timeout for polling
        print("Token minted and ownership confirmed.")

        # 3. List Token
        print("Listing token...")
        page.get_by_role("button", name="2. List NFT for 50 HBAR").click()
        expect(page.locator(".status-message")).to_contain_text("NFT Listed for 50 HBAR", timeout=60000)
        print("Token listed.")

        print("Taking screenshot...")
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)
