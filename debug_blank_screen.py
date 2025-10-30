from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    print("--- Capturing Browser Console Logs ---")

    # Listen for all console events and print them
    page.on("console", lambda msg: print(f"BROWSER LOG: [{msg.type}] {msg.text}"))

    try:
        # Navigate to the local server
        page.goto("http://localhost:5173/", timeout=15000)

        # Wait for a few seconds to ensure all startup scripts have run
        page.wait_for_timeout(5000)

        print("\n--- Page loaded without immediate crash ---")

    except Exception as e:
        print(f"\n--- An error occurred during page load: {e} ---")

    finally:
        print("\n--- Dev Server Logs ---")
        with open("skillswap-react-dev.log", "r") as f:
            print(f.read())

        context.close()
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
