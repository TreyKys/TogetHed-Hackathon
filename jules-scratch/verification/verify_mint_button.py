from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:5173")

            # Create a vault
            page.get_by_role("button", name="Create Your Secure Vault").click()
            page.wait_for_selector("text=✅ Secure vault created!")

            # Click the mint button
            page.get_by_role("button", name="1. Mint RWA NFT").click()

            # Wait for the minting process to start
            page.wait_for_selector("text=🚀 Minting RWA NFT...")

            # Wait for the minting process to complete or fail
            page.wait_for_selector("text*='✅ NFT Minted!' or text*='❌ Minting Failed:'")

            page.screenshot(path="jules-scratch/verification/verification.png")
            print("Screenshot taken.")
        except Exception as e:
            print(f"An error occurred: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
