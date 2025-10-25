from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))
        try:
            page.goto("http://localhost:5176/", timeout=120000)

            vault_button = page.get_by_role("button", name="Create Your Secure Vault")
            expect(vault_button).to_be_enabled(timeout=120000)
            vault_button.click()

            expect(page.locator(".status-message")).to_contain_text("Secure vault created!", timeout=240000)
            page.wait_for_timeout(5000)

            mint_button = page.get_by_role("button", name="1. Mint RWA NFT")
            expect(mint_button).to_be_enabled(timeout=240000)
            mint_button.click()

            expect(page.locator(".status-message")).to_contain_text("Mock NFT Minted!", timeout=240000)
            page.wait_for_timeout(5000)

            list_button = page.get_by_role("button", name="2. List NFT for 50 HBAR")
            expect(list_button).to_be_enabled(timeout=240000)
            list_button.click()

            expect(page.locator(".status-message")).to_contain_text("NFT Listed", timeout=240000)
            page.screenshot(path="jules-scratch/verification/verification.png")
        finally:
            browser.close()

run()
