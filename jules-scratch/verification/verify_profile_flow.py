from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the base URL to set local storage
    page.goto("http://localhost:5173/")
    page.evaluate("() => { localStorage.setItem('accountId', '0.0.98765'); localStorage.setItem('privateKey', '302e020101042012345678901234567890123456789012345678901234567890123456789012a00706052b8104000a'); }")

    # Navigate to the marketplace
    page.goto("http://localhost:5173/marketplace")

    # Wait for the h1 to be visible
    page.wait_for_selector("h1")

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/profile-state.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
