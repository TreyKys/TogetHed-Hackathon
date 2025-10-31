from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Listen for console logs
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

    # Go to the base URL to set local storage
    page.goto("http://localhost:5173/")
    page.evaluate("() => { localStorage.setItem('accountId', '0.0.98765'); localStorage.setItem('privateKey', '302e020101042012345678901234567890123456789012345678901234567890123456789012a00706052b8104000a'); }")

    # Navigate to the marketplace
    page.goto("http://localhost:5173/marketplace")

    # Wait for the listings to load
    page.wait_for_selector(".listing-card")

    # Click the first "Buy Now" button
    page.locator(".buy-button").first.click()

    # Wait for the confirmation modal to appear
    page.wait_for_selector("text=Confirm Purchase")

    # Click the confirm button
    page.get_by_role("button", name="Confirm").click()

    # Wait for the toast notification
    page.wait_for_selector(".toast")

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/buy-now-error.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
