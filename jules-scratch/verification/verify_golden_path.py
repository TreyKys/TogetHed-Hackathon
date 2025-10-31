from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5173")

        # Use localStorage to bypass vault creation and inject credentials
        # This is a more reliable way to test protected flows
        account_id = "0.0.12345" # Placeholder
        private_key = "0x0000000000000000000000000000000000000000000000000000000000000001" # Placeholder
        evm_address = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" # Placeholder corresponding to the dummy private key

        page.evaluate(f"""() => {{
            localStorage.setItem('integro-account-id', '{account_id}');
            localStorage.setItem('integro-private-key', '{private_key}');
            localStorage.setItem('integro-evm-address', '{evm_address}');
        }}""")

        # Reload the page to apply the logged-in state
        page.reload()

        # Wait for the main UI to appear after "login"
        expect(page.get_by_role("heading", name="Golden Path Walkthrough")).to_be_visible(timeout=20000)

        # We expect the on-chain transactions to fail with placeholders,
        # but we can verify the UI is now rendering the logged-in state.

        page.screenshot(path="jules-scratch/verification/golden_path_loggedin.png")
        print("Screenshot saved to jules-scratch/verification/golden_path_loggedin.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
        print("Error screenshot saved to jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)
