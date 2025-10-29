from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:5173/")
    page.screenshot(path="jules-scratch/verification/01_landing_page.png")
    page.click("text=Create Your Secure Vault")
    page.wait_for_url("**/profile-setup", timeout=60000)
    page.wait_for_selector("text=Set Up Your Profile")
    page.screenshot(path="jules-scratch/verification/02_profile_setup.png")
    page.fill('input[id="displayName"]', "Jules")
    page.select_option('select[id="role"]', "Producer/Vendor")
    page.fill('input[id="location"]', "Paris")
    page.click("text=Save and Enter Marketplace")
    page.wait_for_url("**/marketplace", timeout=60000)
    page.wait_for_selector("text=Welcome to the Integro Marketplace.")
    page.screenshot(path="jules-scratch/verification/03_marketplace.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
