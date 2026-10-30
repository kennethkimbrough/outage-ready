import { expect, test, type Page } from "@playwright/test";

const SHOTS = "docs/screenshots";

async function loadSample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a sample household" }).click();
  await expect(page.getByRole("heading", { name: "How long could you hold out?" })).toBeVisible();
}

test("walks the intake wizard and lands on the scenarios", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByText("Know what you can sustain")).toBeVisible();
  await page.getByRole("link", { name: "Start with my household" }).click();
  await expect(page.getByRole("heading", { name: "Who lives here?" })).toBeVisible();
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { name: "Your home" })).toBeVisible();
  await page.getByLabel("An electric pump or a well").check();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { name: "Water and food" })).toBeVisible();
  await page.getByLabel("Stored drinking water (litres)").fill("10");
  await page.getByLabel("Food that needs no fridge, in person-days").fill("6");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { name: "Power and light" })).toBeVisible();
  await page.getByRole("button", { name: "Add a power bank" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Medication" })).toBeVisible();
  await page.getByRole("button", { name: "Skip, none needed" }).click();
  await expect(page.getByRole("heading", { name: "Transport and money" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Emergency contacts" })).toBeVisible();
  await page.getByRole("button", { name: "Add a contact" }).click();
  await page.getByLabel("Name").fill("Alex");
  await page.getByLabel("Phone").fill("+1 555 0100");
  await page.getByRole("button", { name: "See my scenarios" }).click();

  await expect(page.getByRole("heading", { name: "How long could you hold out?" })).toBeVisible();
  await expect(page.getByText("2 people in your household")).toBeVisible();
  // Two people, 10 L, pumped supply: water lasts 10 / (2 * 3.785) ≈ 1.3 days of the 2-day power scenario.
  await page.getByRole("link", { name: /Power outage/ }).click();
  await expect(page.getByRole("heading", { name: "Covered for 1 day 8 h of 2 days" })).toBeVisible();
  await expect(page.getByText("Water from the tap")).toBeVisible();
  if (info.project.name === "mobile") await page.screenshot({ path: `${SHOTS}/scenario-power.png`, fullPage: false });
});

test("scenario cards, timeline, tasks and print plan render for the sample", async ({ page }, info) => {
  await loadSample(page);
  const shot = info.project.name === "mobile" ? "mobile" : "desktop";
  await page.screenshot({ path: `${SHOTS}/home-${shot}.png`, fullPage: false });

  await page.getByRole("link", { name: /Typhoon or flood/ }).click();
  await expect(page.locator("svg.timeline")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fails first" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Do now" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/storm-${shot}.png`, fullPage: true });

  // Ticking a task persists across reloads.
  const first = page.locator("input[data-action=task]").first();
  const savedBefore = await page.evaluate(() => document.body.dataset.savedAt ?? "");
  await first.check();
  await page.waitForFunction((prev) => (document.body.dataset.savedAt ?? "") !== prev, savedBefore);
  await page.reload();
  await expect(page.locator("input[data-action=task]").first()).toBeChecked();

  await page.goto("/#/print");
  await expect(page.getByRole("heading", { name: "Household backup plan" })).toBeVisible();
  await expect(page.getByText("Emergency contacts")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: `${SHOTS}/print-${shot}.png`, fullPage: true });
  await page.emulateMedia({ media: "screen" });

  await page.goto("/#/assumptions");
  await expect(page.getByText("Drinking and sanitation water per person per day")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ready.gov: Water" }).first()).toBeVisible();
});

test("changing an assumption changes the result", async ({ page }) => {
  await loadSample(page);
  await page.goto("/#/scenario/water");
  const before = await page.getByRole("heading", { level: 1 }).textContent();
  await page.goto("/#/assumptions");
  const input = page.getByLabel("Drinking and sanitation water per person per day");
  await input.fill("1");
  await input.press("Tab");
  await expect(page.getByText("edited")).toBeVisible();
  await page.goto("/#/scenario/water");
  const after = await page.getByRole("heading", { level: 1 }).textContent();
  expect(after).not.toBe(before);
});

test("export produces a JSON file with the plan", async ({ page }) => {
  await loadSample(page);
  await page.goto("/#/data");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export as JSON" }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const text = await (await import("node:fs/promises")).readFile(path!, "utf8");
  const parsed = JSON.parse(text);
  expect(parsed.app).toBe("outage-ready");
  expect(parsed.plan.household.people.length).toBe(2);
});

test("still works offline after the first visit", async ({ page, context, browserName }, info) => {
  test.skip(browserName !== "chromium", "service worker control is Chromium-only in Playwright");
  await loadSample(page);
  // Wait for the service worker to take control and finish precaching.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15_000 });
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    if (!keys.length) return false;
    const cache = await caches.open(keys[0]!);
    const entries = await cache.keys();
    return entries.length >= 20;
  }, null, { timeout: 15_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "How long could you hold out?" })).toBeVisible();
  await expect(page.locator("#offline-badge")).toBeVisible();
  await page.getByRole("link", { name: /Heatwave/ }).click();
  await expect(page.locator("svg.timeline")).toBeVisible();
  if (info.project.name === "mobile") await page.screenshot({ path: `${SHOTS}/offline-mobile.png`, fullPage: false });
  await context.setOffline(false);
});
