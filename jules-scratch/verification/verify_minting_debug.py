from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Listen for all console events and print them to the terminal
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

    try:
        # 1. Arrange: Go to the application's homepage.
        page.goto("http://localhost:8000", wait_until="networkidle", timeout=20000)
        print("SCRIPT LOG: Page loaded.")

        # 2. Act: Find the "Mint RWA NFT" button and click it.
        mint_button = page.get_by_role("button", name="1. Mint RWA NFT")
        expect(mint_button).to_be_visible(timeout=10000)
        print("SCRIPT LOG: Mint button found. Clicking...")
        mint_button.click()

        # 3. Assert & Debug: Wait for either a success or failure message.
        success_locator = page.locator(".status-message:has-text('🎉 Minting Complete!')")
        error_locator = page.locator(".status-message:has-text('❌ Minting Failed')")

        combined_locator = success_locator.or_(error_locator)
        combined_locator.wait_for(state="visible", timeout=90000)
        print("SCRIPT LOG: Found a final status message (success or error).")

        final_status_text = combined_locator.inner_text()
        print(f"SCRIPT LOG: Final UI status: {final_status_text}")

    except Exception as e:
        print(f"SCRIPT ERROR: An exception occurred: {e}")
    finally:
        # 4. Screenshot: Capture the final state regardless of outcome for debugging.
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("SCRIPT LOG: Screenshot taken.")
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
