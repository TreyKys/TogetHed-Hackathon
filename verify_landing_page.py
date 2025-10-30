from playwright.sync_api import sync_playwright

def verify_landing_page(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        print("Navigating to http://localhost:8000 for verification...")
        # Give the page plenty of time to load all external image assets
        page.goto("http://localhost:8000", timeout=90000, wait_until="networkidle")
        print("Page loaded. Taking screenshot...")
        screenshot_path = "landing-page-verification.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"✅ Screenshot saved successfully to {screenshot_path}")
    except Exception as e:
        print(f"❌ An error occurred during verification: {e}")
        page.screenshot(path="verification_error.png")
    finally:
        browser.close()

with sync_playwright() as p:
    verify_landing_page(p)
