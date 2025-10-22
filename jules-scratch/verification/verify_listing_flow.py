
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Navigate to the app
        page.goto("http://localhost:5174/")

        # 2. Create a vault
        page.get_by_role("button", name="Create Your Secure Vault").click()
        # Wait for vault creation to complete by looking for the success message
        expect(page.locator(".status-message")).to_contain_text("✅ Secure vault created!", timeout=20000)

        # 3. Mint an NFT
        page.get_by_role("button", name="1. Mint RWA NFT").click()
        # Wait for minting to complete
        expect(page.locator(".status-message")).to_contain_text("✅ NFT Minted!", timeout=20000)

        # 4. List the NFT
        page.get_by_role("button", name="2. List NFT for 50 HBAR").click()
        # Wait for listing to complete
        expect(page.locator(".status-message")).to_contain_text("✅ NFT Listed for 50 HBAR!", timeout=20000)

        # 5. Take a screenshot of the final state
        page.screenshot(path="jules-scratch/verification/verification.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        # Capture a screenshot on error for debugging
        page.screenshot(path="jules-scratch/verification/error_screenshot.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)
