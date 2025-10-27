
import asyncio
from playwright.async_api import async_playwright
import sys
import argparse

async def run_verification(private_key: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Add a listener for all console logs
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

        try:
            print("Navigating to the application...")
            await page.goto("http://localhost:4173", timeout=60000)

            # 1. Create Vault
            print("Attempting to create a new vault...")
            vault_button_selector = "button:has-text('Create a new Vault')"
            await page.wait_for_selector(vault_button_selector, timeout=30000)

            # Check if the private key is already in local storage
            stored_key = await page.evaluate("() => window.localStorage.getItem('integro-private-key')")

            # Use the provided private key
            print(f"Using provided private key: {private_key}")
            await page.evaluate(f"window.localStorage.setItem('integro-private-key', '{private_key}')")
            await page.reload()
            await page.wait_for_selector("button:has-text('Mint New RWA')", timeout=30000)

            print("Vault exists, proceeding to Mint.")

            # 2. Mint NFT
            print("Attempting to mint a new RWA...")
            await page.click("button:has-text('Mint New RWA')")

            print("Waiting for minting to complete...")
            await page.wait_for_selector("text=/Successfully minted NFT with serial number: \\d+/", timeout=180000) # Extended timeout
            print("Minting successful!")

            # 3. Approve
            print("Attempting to approve the Escrow contract...")
            await page.click("button:has-text('Approve Escrow Contract')")

            print("Waiting for approval to complete...")
            await page.wait_for_selector("text=Approval successful!", timeout=120000)
            print("Approval successful!")

            # 4. List NFT
            print("Attempting to list the NFT for sale...")
            list_button = page.locator("button:has-text('List NFT for Sale')")

            # Check if the button is enabled before clicking
            is_enabled = await list_button.is_enabled()
            if not is_enabled:
                print("ERROR: List button is not enabled after approval.")
                raise Exception("List button disabled")

            await list_button.click()

            print("Waiting for listing to complete...")
            await page.wait_for_selector("text=NFT listed successfully!", timeout=120000)
            print("Listing successful!")

            print("✅ ✅ ✅ VERIFICATION COMPLETE: Full flow succeeded! ✅ ✅ ✅")

        except Exception as e:
            print(f"❌ ❌ ❌ VERIFICATION FAILED: An error occurred. ❌ ❌ ❌")
            print(f"Error details: {e}")
            await page.screenshot(path="jules-scratch/error_screenshot.png")
            print("Screenshot saved to jules-scratch/error_screenshot.png")
            sys.exit(1) # Exit with a non-zero code to indicate failure

        finally:
            await browser.close()

async def main():
    parser = argparse.ArgumentParser(description="Run Playwright verification script.")
    parser.add_argument("--private-key", required=True, help="The private key to use for the vault.")
    args = parser.parse_args()

    await run_verification(args.private_key)

if __name__ == "__main__":
    # Create the scratch directory if it doesn't exist
    import os
    if not os.path.exists("jules-scratch"):
        os.makedirs("jules-scratch")

    asyncio.run(main())
