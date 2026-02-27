const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000); // Wait for fetchHeroes

    // Find Add Ban button
    const banButton = page.locator('button:has-text("+ Add Ban")').first();
    if (await banButton.count() > 0) {
      await banButton.click();
      await page.waitForTimeout(1000); // Wait for modal

      const sources = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.hero-grid-item img')).slice(0, 5).map(img => img.src);
      });
      console.log("Image sources from DOM:", sources);
    } else {
      console.log("Could not find Add Ban button");
    }
  } catch (e) {
    console.error("Test error:", e);
  } finally {
    await browser.close();
  }
})();
