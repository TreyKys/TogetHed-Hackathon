
import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Log in
    page.goto("http://localhost:5173/")
    page.evaluate("() => { localStorage.setItem('integro-account-id', '0.0.6953403'); }")
    page.evaluate("() => { localStorage.setItem('integro-private-key', '302e020100300506032b65700422042091132178e72057a1d7528025956fe3950b8fa5da58838e3e4776e0cb7ec0d3d5'); }")
    page.evaluate("() => { localStorage.setItem('integro-evm-address', '0x1A141443569A569341618335b86a11728469aC3d'); }")
    page.goto("http://localhost:5173/marketplace")

    # Wait for the marketplace to load
    page.wait_for_selector(".listings-grid")

    # Buy an asset
    page.get_by_role("button", name="Buy Now").first.click()

    # Open sidebar
    page.locator(".menu-icon").click()

    # Navigate to My Assets
    page.get_by_role("link", name="My Assets").click()

    # Wait for the assets to load
    page.wait_for_selector(".assets-grid")

    # Confirm Delivery
    page.get_by_role("button", name="Confirm Delivery").first.click()

    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
