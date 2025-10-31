from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the base URL to set local storage
    page.goto("http://localhost:8000/")
    page.evaluate("() => { localStorage.setItem('accountId', '0.0.12345'); localStorage.setItem('privateKey', '302e020101042012345678901234567890123456789012345678901234567890123456789012a00706052b8104000a'); }")

    # Navigate to the marketplace
    page.goto("http://localhost:8000/marketplace")

    # Open the sidebar
    page.get_by_role("button", name="Menu").click()

    # Click the "User Profile" link
    page.get_by_role("link", name="User Profile").click()

    # Wait for navigation and take a screenshot
    page.wait_for_url("http://localhost:8000/profile")
    page.screenshot(path="jules-scratch/verification/profile-page.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
