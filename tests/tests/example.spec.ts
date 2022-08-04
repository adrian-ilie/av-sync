/*import { test, expect } from '@playwright/test';

test('homepage has Playwright in title and get started link linking to the intro page', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);

  // create a locator
  const getStarted = page.locator('text=Get Started');

  // Expect an attribute "to be strictly equal" to the value.
  await expect(getStarted).toHaveAttribute('href', '/docs/intro');

  // Click the get started link.
  await getStarted.click();

  // Expects the URL to contain intro.
  await expect(page).toHaveURL(/.*intro/);
});
*/



import { test as base, expect, BrowserContext, chromium } from "@playwright/test";
import path from "path";


export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({ }, use) => {
    const pathToExtension = path.join(__dirname, "../../extension");
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    /*
    // for manifest v2:
    let [background] = context.backgroundPages()
    if (!background)
      background = await context.waitForEvent("backgroundpage")
    */

    // for manifest v3:
    let [background] = context.serviceWorkers();
    if (!background)
      background = await context.waitForEvent("serviceworker");

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});


test("example test", async ({ page }) => {
  await page.goto("https://www.youtube.com/watch?v=-UYyGbcyuJ8");
  
  // Click on <a> "REJECT ALL"
  await page.click('.style-primary:nth-child(1) > .yt-simple-endpoint');
  
  // Click on <button> #yt-av-sync
  await page.click('#yt-av-sync');

  // Click on <input> #delayInPlayer
  await page.click('#delayInPlayer');

  // Fill "-600" on <input> #delayInPlayer
  await page.fill('#delayInPlayer', "-600");

  // Click on <button> #saveDelay
  await page.click('#saveDelay');

  // Click on <button> "x"
  await page.click('#yt-av-sync-menu-close-button');

  // Click on <button> #yt-av-sync
  await page.click('#yt-av-sync');
  
  //await expect(page.locator("body")).toHaveText("Changed by my-extension");
});

/*
test("options page", async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/html/options.html`);
  await expect(page.locator("body")).toHaveText("YouTube Audio/Video");
});*/