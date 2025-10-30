from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    try:
        page.goto("http://localhost:5173/")
        page.get_by_role("button", name="Create Your Secure Vault").click()

        page.wait_for_url("http://localhost:5173/profile-setup")
        page.screenshot(path="jules-scratch/verification/01_profile_setup.png")

        page.get_by_label("Name").fill("Test User")
        page.get_by_label("Age").fill("30")
        page.get_by_label("I am a...").select_option("Seller")
        page.get_by_label("Phone Number").fill("1234567890")
        page.get_by_role("button", name="Save & Enter Marketplace").click()

        page.wait_for_url("http://localhost:5173/marketplace")
        page.wait_for_selector("h1:text('Integro Marketplace')")
        page.screenshot(path="jules-scratch/verification/02_marketplace.png")

        page.locator(".menu-toggle").click()

        page.wait_for_selector(".nav-menu.open")
        page.screenshot(path="jules-scratch/verification/03_marketplace_menu_open.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
