
import time
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Navigate to the app
        page.goto("http://localhost:5174")
        print("Page loaded.")

        # 2. Create a new vault
        # Wait for the button to be available before clicking
        create_vault_button = page.locator('button:has-text("Create New Vault")')
        expect(create_vault_button).to_be_enabled(timeout=15000) # Increased timeout
        create_vault_button.click()
        print("Create New Vault button clicked.")

        # 3. Mint the NFT
        # Wait for the "Mint RWA NFT" button to appear and be enabled
        mint_button = page.locator('button:has-text("Mint RWA NFT")')
        expect(mint_button).to_be_enabled(timeout=25000) # Allow time for account creation
        mint_button.click()
        print("Mint RWA NFT button clicked.")

        # 4. List the NFT
        # Wait for the "List NFT for Sale" button to appear and be enabled
        list_button = page.locator('button:has-text("List NFT for Sale")')
        expect(list_button).to_be_enabled(timeout=30000) # Allow time for minting
        list_button.click()
        print("List NFT for Sale button clicked.")

        # 5. Verify the listing was successful
        # The button text should change to "Cancel Listing"
        cancel_button = page.locator('button:has-text("Cancel Listing")')
        expect(cancel_button).to_be_visible(timeout=20000)
        print("NFT successfully listed, 'Cancel Listing' button is visible.")

        # 6. Take a screenshot
        page.screenshot(path="jules-scratch/verification/golden_path_success.png")
        print("Screenshot taken.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error_screenshot.png")


    finally:
        # Close browser
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)
