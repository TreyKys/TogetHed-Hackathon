from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))
        try:
            page.goto("http://localhost:5177/")
            page.get_by_role("button", name="Create Your Secure Vault").click()
            expect(page.locator(".status-message")).to_contain_text("Secure vault created!", timeout=120000)
            page.wait_for_timeout(1000) # Give React a moment to re-render
            expect(page.get_by_role("button", name="1. Mint RWA NFT")).to_be_enabled(timeout=120000)
            page.get_by_role("button", name="1. Mint RWA NFT").click()
            expect(page.locator(".status-message")).to_contain_text("Mock NFT Minted!", timeout=120000)
            page.get_by_role("button", name="2. List NFT for 50 HBAR").click()
            expect(page.locator(".status-message")).to_contain_text("NFT Listed", timeout=120000)
            page.screenshot(path="jules-scratch/verification/verification.png")
        finally:
            browser.close()

run()
