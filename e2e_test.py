import re
import time
from playwright.sync_api import sync_playwright, expect

def run_test(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Capture all console logs
    page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

    try:
        print("Navigating to the application...")
        page.goto("http://localhost:5174/", timeout=60000)

        # --- 1. Create Vault ---
        print("--- Step 1: Creating Vault ---")
        create_vault_button = page.get_by_role("button", name="Create Your Secure Vault")
        expect(create_vault_button).to_be_enabled(timeout=30000)
        create_vault_button.click()

        print("Waiting for vault creation to complete...")
        expect(page.locator(".status-message")).to_contain_text("✅ Secure vault created!", timeout=120000)
        print("Vault created successfully.")

        # --- 2. Mint NFT ---
        print("\n--- Step 2: Minting NFT ---")
        mint_button = page.get_by_role("button", name="1. Mint RWA NFT")
        expect(mint_button).to_be_enabled(timeout=30000)
        mint_button.click()

        print("Waiting for minting to complete...")
        expect(page.locator(".status-message")).to_contain_text("✅ NFT Minted!", timeout=180000)
        print("NFT minted successfully.")

        # --- 3. List NFT ---
        print("\n--- Step 3: Listing NFT ---")
        list_button = page.get_by_role("button", name="2. List NFT for 50 HBAR")
        expect(list_button).to_be_enabled(timeout=30000)
        list_button.click()

        print("Waiting for listing to complete...")
        expect(page.locator(".status-message")).to_contain_text("✅ NFT Listed for 50 HBAR!", timeout=120000)
        print("NFT listed successfully.")

        # --- 4. Buy NFT (Fund Escrow) ---
        print("\n--- Step 4: Buying NFT (Funding Escrow) ---")
        buy_button = page.get_by_role("button", name="3. Buy Now (Fund Escrow)")
        expect(buy_button).to_be_enabled(timeout=30000)
        buy_button.click()

        print("Waiting for escrow funding...")
        expect(page.locator(".status-message")).to_contain_text("✅ Escrow Funded!", timeout=120000)
        print("Escrow funded successfully.")

        # --- 5. Confirm Delivery ---
        print("\n--- Step 5: Confirming Delivery ---")
        confirm_button = page.get_by_role("button", name="4. Confirm Delivery")
        expect(confirm_button).to_be_enabled(timeout=30000)
        confirm_button.click()

        print("Waiting for final confirmation...")
        expect(page.locator(".status-message")).to_contain_text("🎉 SALE COMPLETE!", timeout=120000)
        print("Sale completed successfully.")

        print("\n✅✅✅ End-to-end test completed successfully! ✅✅✅")

    except Exception as e:
        print(f"\n❌❌❌ Test failed: {e} ❌❌❌")
        page.screenshot(path="test_failure.png")
        print("Screenshot saved to test_failure.png")

    finally:
        page.screenshot(path="final_state.png")
        print("Final state screenshot saved to final_state.png")
        browser.close()

with sync_playwright() as p:
    run_test(p)
