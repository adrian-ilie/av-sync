import { test as base, expect, BrowserContext, chromium } from "@playwright/test";
import path from "path";

var HeadphoneMediaDevices: MediaDeviceInfo[] = GetMockMediaDevices("Headphones Mock Device");
var SpeakersMediaDevices: MediaDeviceInfo[] = GetMockMediaDevices("Speakers Mock Device");

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
        '--use-fake-device-for-media-stream' //this is needed for working with mediaDevices
      ],
      permissions: ['microphone'] //this is needed for working with mediaDevices
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

// Configure mock API before each test.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(SetMockEnumerateDevices, HeadphoneMediaDevices);
});

test.afterEach(async ({ page }) => {
  await page.close();;
});

test.afterAll(async ({ browser }) => {
  await browser.close();
});

function GetMockMediaDevices(mediaServiceLabel) {
  function getRandomAlphaNumericId(length) {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    // Pick characers randomly
    let str = '';
    for (let i = 0; i < length; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  }

  let kindAudioOutput: MediaDeviceKind = "audiooutput";

  const randomDeviceId = getRandomAlphaNumericId(64);
  const randomGroupId = getRandomAlphaNumericId(64);

  type MockMediaDeviceInfo = Omit<MediaDeviceInfo, 'toJSON'>;
  let mockMediaDeviceInfo1: MockMediaDeviceInfo = {
    deviceId: "default",
    kind: kindAudioOutput,
    label: `Default - ${mediaServiceLabel}`,
    groupId: randomGroupId,
  };

  let mockMediaDeviceInfo2: MockMediaDeviceInfo = {
    deviceId: randomDeviceId,
    kind: kindAudioOutput,
    label: mediaServiceLabel,
    groupId: randomGroupId,
  };

  let mockDeviceInfo1 = mockMediaDeviceInfo1 as MediaDeviceInfo;
  let mockDeviceInfo2 = mockMediaDeviceInfo2 as MediaDeviceInfo;

  return [mockDeviceInfo1, mockDeviceInfo2];
}

async function SetMockEnumerateDevices(mediaDevices: MediaDeviceInfo[]) {
  navigator.mediaDevices.enumerateDevices = function () {
    return new Promise((res, rej) => { res(mediaDevices) })
  }
}

// new instalation youtube menu works
test("after new instalation youtube menu works", async ({ page, context, extensionId }) => {
  const rejectAllCookies = page.locator('.eom-buttons > ytd-button-renderer');
  const syncAudioLocator = page.locator('syncAudio');
  const enableDisableExtensionButton = await page.locator('#yt-av-sync-menu > .ytp-panel > .ytp-panel-menu > div:nth-child(2)');
  const ytAvSyncButton = page.locator('#yt-av-sync');
  const delayInPlayer = page.locator('#delayInPlayer');
  const delayPlusButton = page.locator('button:has-text("+")');
  const delayMinusButton = page.locator('button:has-text("-")');
  const avSyncMenuCloseButton = page.locator('#yt-av-sync-menu-close-button');

  await CloseExtensionOptionsPage(context, page, extensionId);

  await page.goto("https://www.youtube.com/watch?v=VT6jxtnxSWs");

  await expect(syncAudioLocator).not.toBeUndefined();

  // Click on <a> "REJECT ALL"
  await rejectAllCookies.click();

  //Av Sync button is visible
  await expect(ytAvSyncButton).toBeVisible();

  const enableDisableExtensionButtonAriaChecked = await enableDisableExtensionButton.getAttribute("aria-checked")
  await expect(enableDisableExtensionButtonAriaChecked).toContain("true")

  await expect(delayInPlayer).toBeHidden();

  // Click on <button> #yt-av-sync
  await ytAvSyncButton.click();

  await expect(delayInPlayer).toBeVisible();

  // Initial value of delayInPlayer is set 0
  await expect(delayInPlayer).toHaveValue("0");

  // Click button:has-text("+")
  await delayPlusButton.click();
  await expect(delayInPlayer).toHaveValue("1");
  const validityStatusPositiveValue = await delayInPlayer.evaluate((element: HTMLInputElement) => element.checkValidity())
  await expect(validityStatusPositiveValue).toBeTruthy();

  // Click twice button:has-text("-")
  await delayMinusButton.click();
  await delayMinusButton.click();
  await expect(delayInPlayer).toHaveValue("-1");
  const validityStatusNegativeValue = await delayInPlayer.evaluate((element: HTMLInputElement) => element.checkValidity())
  await expect(validityStatusNegativeValue).toBeTruthy();

  // Fill delayInPlayer with too large number
  await delayInPlayer.fill("5001")
  const validityStatusTooLargePositive = await delayInPlayer.evaluate((element: HTMLInputElement) => element.checkValidity())
  await expect(validityStatusTooLargePositive).toBeFalsy();

  // Fill delayInPlayer with too large negative number
  await delayInPlayer.fill("-5001")
  const validityStatusTooLargeNegative = await delayInPlayer.evaluate((element: HTMLInputElement) => element.checkValidity())
  await expect(validityStatusTooLargeNegative).toBeFalsy();

  await avSyncMenuCloseButton.click();
});


const mediaDeviceConnectedTestOptions = [{
  mediaDevice: HeadphoneMediaDevices,
  extensionEnabled: "true",
  syncAudioCount: 1
},
{
  mediaDevice: SpeakersMediaDevices,
  extensionEnabled: "false",
  syncAudioCount: 0
}]

for (const testOption of mediaDeviceConnectedTestOptions) {
  test(`Device connected, expect extension enabled = ${testOption.extensionEnabled}`, async ({ page, context, extensionId }) => {
    const rejectAllCookies = page.locator('.style-primary:nth-child(1) > .yt-simple-endpoint');
    const syncAudioLocator = page.locator('#syncAudio');
    const enableDisableExtensionButton = await page.locator('#yt-av-sync-menu > .ytp-panel > .ytp-panel-menu > div:nth-child(2)');
    const ytAvSyncButton = page.locator('#yt-av-sync');
    const delayInPlayer = page.locator('#delayInPlayer');
    const youtubeProgressBar = page.locator('.ytp-timed-markers-container');
    const youtubeVideo = page.locator('video')

    await CloseExtensionOptionsPage(context, page, extensionId);

    let extensionOptionsPage = await context.newPage();
    const autoToggleSyncCheckbox = extensionOptionsPage.locator('input[type="checkbox"]');

    await extensionOptionsPage.addInitScript(SetMockEnumerateDevices, testOption.mediaDevice);

    await extensionOptionsPage.goto(`chrome-extension://${extensionId}/html/options.html`);

    await expect(extensionOptionsPage).not.toBeUndefined();

    await page.goto("https://www.youtube.com/watch?v=VT6jxtnxSWs");

    await expect(syncAudioLocator).not.toBeUndefined();

    // Click on <a> "REJECT ALL"
    await rejectAllCookies.click();

    await autoToggleSyncCheckbox.check();

    // Check Auto toggle sync when current audio device is connected

    await page.bringToFront(); //the tab needs to be active in order for the page to be refreshed when the device changes (background page only refreshes the active tab)

    // Click video
    // Click .ytp-timed-markers-container, it will move the playback to the middle of the video
    await youtubeProgressBar.click();
    const currentTimeBeforeMediaDeviceChange = await youtubeVideo.getAttribute("currentTime") as unknown as number;

    await DispatchDeviceChangeEvent(page);

    await extensionOptionsPage.waitForTimeout(1000); //todo find a better way to wait for the devicechange dispatch event

    const currentTimeAfterMediaDeviceChange = await youtubeVideo.getAttribute("currentTime") as unknown as number;

    await ytAvSyncButton.click();
    await expect(delayInPlayer).toBeVisible();

    const attr = await enableDisableExtensionButton.getAttribute("aria-checked")
    await expect(attr).toContain(testOption.extensionEnabled)

    const timeDifference = currentTimeAfterMediaDeviceChange - currentTimeBeforeMediaDeviceChange;
    await expect(Math.abs(timeDifference)).toBeLessThan(100) //todo adjust for delay value

    //await extensionOptionsPage.waitForTimeout(6000); //to find a better way to wait for the element

    await expect(syncAudioLocator).toHaveCount(testOption.syncAudioCount);

    //await page.pause();
  });
}

async function DispatchDeviceChangeEvent(page) {
  let mediaDeviceManagerIframe = await page.frame({name: "mediaDeviceManagerIframe"});
  mediaDeviceManagerIframe.evaluate(async () => {
    if (navigator.mediaDevices !== undefined) {
      //console.log("Message from Iframe")
      //var devices = await navigator.mediaDevices.enumerateDevices()
      //console.log(JSON.stringify(devices))
      const e = new Event("devicechange");
      navigator.mediaDevices.dispatchEvent(e);
    }
  });

  //await page.pause();
}

async function CloseExtensionOptionsPage(context, page, extensionId) {
  let openedPages = context.pages()
  const optionsPage = openedPages.find(op => op.url() === `chrome-extension://${extensionId}/html/options.html`)
  await optionsPage.close();
}
