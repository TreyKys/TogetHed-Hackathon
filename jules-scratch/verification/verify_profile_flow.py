from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the base URL to set local storage
    page.goto("http://localhost:5173/")
    page.evaluate("() => { localStorage.setItem('accountId', '0.0.98765'); localStorage.setItem('privateKey', '302e020101042012345678901234567890123456789012345678901234567890123456789012a00706052b8104000a'); }")

    # Navigate to the marketplace
    page.goto("http://localhost:5173/marketplace")

    # Check for the "complete your profile" toast
    page.wait_for_selector("text=Please complete your profile to create listings.")

    # Open the sidebar
    page.get_by_role("button", name="Menu").click()

    # Click the "User Profile" link
    page.get_by_role("link", name="User Profile").click()

    # Wait for navigation and fill out the form
    page.wait_for_url("http://localhost:5173/profile")
    page.get_by_label("Name").fill("Test User")
    page.get_by_label("Location").fill("Test Location")
    page.get_by_label("Bio").fill("This is a test bio.")
    page.get_by_role("button", name="Save Profile").click()

    # Check for the success toast
    page.wait_for_selector("text=Profile updated successfully!")

    # Navigate back to the marketplace
    page.goto("http://localhost:5173/marketplace")

    # Take a screenshot to show the notification is gone
    page.screenshot(path="jules-scratch/verification/profile-complete.png")

    time.sleep(10)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
