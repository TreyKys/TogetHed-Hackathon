import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        page.set_default_timeout(90000) # 90 second timeout

        # Open a log file
        with open("browser_console.log", "w") as log_file:
            # Register a console message handler
            page.on("console", lambda msg: log_file.write(f"{msg.text}\n"))

            try:
                await page.goto("http://localhost:5173")

                # Create Vault and wait for it to be ready
                await page.click("text=Create Your Secure Vault")
                await page.wait_for_selector("text=✅ Secure vault created!")

                # Mint
                await page.click("text=1. Mint RWA NFT")
                await page.wait_for_selector("text=✅ NFT Minted!")

                # List
                await page.click("text=2. List NFT for 50 HBAR")
                await page.wait_for_selector("text=✅ NFT Listed for 50 HBAR!")

                # Buy
                await page.click("text=3. Buy Now (Fund Escrow)")
                await page.wait_for_selector("text=✅ Escrow Funded!")

                # Confirm
                await page.click("text=4. Confirm Delivery")
                await page.wait_for_selector("text=🎉 SALE COMPLETE!")

                await page.screenshot(path="jules-scratch/verification/verification.png")
                print("Test completed successfully!")

            except Exception as e:
                print(f"An error occurred: {e}")
                await page.screenshot(path="jules-scratch/verification/error.png")
            finally:
                await browser.close()

asyncio.run(main())
