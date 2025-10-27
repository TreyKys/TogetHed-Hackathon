
import asyncio
from playwright.async_api import async_playwright
import sys

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Add a listener for all console logs
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

        try:
            print("Navigating to the application...")
            # Use the local preview server URL
            await page.goto("http://localhost:4173", timeout=60000)

            # 1. Create Vault
            print("Attempting to create a new vault...")
            # Use a more specific locator for the vault creation button
            vault_button_selector = "button:has-text('Create Your Secure Vault')"
            await page.wait_for_selector(vault_button_selector, timeout=30000)
            await page.click(vault_button_selector)

            # Wait for the vault to be created and the mint button to appear
            await page.wait_for_selector("button:has-text('1. Mint RWA NFT')", timeout=120000)
            print("Vault created successfully.")

            # 2. Mint NFT
            print("Attempting to mint a new RWA...")
            await page.click("button:has-text('1. Mint RWA NFT')")

            print("Waiting for minting to complete...")
            await page.wait_for_selector("text=/✅ NFT Minted! Serial Number: \\d+/", timeout=180000)
            print("Minting successful!")

            # 3. List NFT
            print("Attempting to list the NFT for sale...")
            await page.click("button:has-text('2. List NFT for 50 HBAR')")

            print("Waiting for listing to complete...")
            await page.wait_for_selector("text=/✅ NFT Listed for 50 HBAR!/", timeout=120000)
            print("Listing successful!")

            # Take a screenshot of the final state
            screenshot_path = "jules-scratch/verification.png"
            await page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

            print("✅ ✅ ✅ VERIFICATION COMPLETE: Full flow succeeded! ✅ ✅ ✅")

        except Exception as e:
            print(f"❌ ❌ ❌ VERIFICATION FAILED: An error occurred. ❌ ❌ ❌")
            print(f"Error details: {e}")
            await page.screenshot(path="jules-scratch/error_screenshot.png")
            print("Screenshot saved to jules-scratch/error_screenshot.png")
            sys.exit(1)

        finally:
            await browser.close()

if __name__ == "__main__":
    import os
    if not os.path.exists("jules-scratch"):
        os.makedirs("jules-scratch")
    asyncio.run(main())
