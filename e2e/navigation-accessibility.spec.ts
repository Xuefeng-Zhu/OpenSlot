import { demoIds } from "./demo-data";
import { loginAsDemoHost } from "./support/auth";
import { expect, test } from "./support/test";

test.describe("dashboard navigation and accessibility", () => {
  test("desktop shell exposes the skip link, route label, and account menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsDemoHost(page, "/dashboard");

    await expect(
      page.getByRole("banner", { name: "Dashboard header" })
    ).toBeVisible();

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#dashboard-main")).toBeFocused();

    await page
      .getByRole("button", { name: "Open account menu for Demo User" })
      .click();
    const profileItem = page.getByRole("menuitem", { name: "Profile" });
    const settingsItem = page.getByRole("menuitem", { name: "Settings" });
    await expect(profileItem).toHaveAttribute("href", "/profile");
    await expect(settingsItem).toHaveAttribute("href", "/settings");
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();

    await settingsItem.click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(
      page.getByRole("banner", { name: "Settings header" })
    ).toBeVisible();
  });

  test("create, edit, public, and reschedule pages each have one h1", async ({
    page,
  }) => {
    test.slow();
    await loginAsDemoHost(page, "/event-types/new");

    const pageCases = [
      { path: "/event-types/new", heading: "Create event type" },
      {
        path: `/event-types/${demoIds.eventType30Min}/edit`,
        heading: "Edit event type",
      },
      { path: "/demo/30-minute-meeting", heading: "30 Minute Meeting" },
      {
        path: `/booking/reschedule/${demoIds.rescheduleToken}`,
        heading: "Reschedule booking",
      },
    ];

    for (const pageCase of pageCases) {
      await test.step(pageCase.path, async () => {
        await page.goto(pageCase.path);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: pageCase.heading,
            exact: true,
          })
        ).toBeVisible();
      });
    }
  });

  test("mobile drawer actions remain reachable and the close target is 40px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDemoHost(page, "/dashboard");

    const menuButton = page.getByRole("button", { name: "Toggle menu" });
    await menuButton.click();

    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toBeFocused();

    const newEventType = drawer.getByRole("link", { name: "New event type" });
    const copyBookingLink = drawer.getByRole("button", {
      name: "Copy booking link",
    });
    const signOut = drawer.getByRole("button", { name: "Sign out" });
    await newEventType.scrollIntoViewIfNeeded();
    await expect(newEventType).toHaveAttribute("href", "/event-types/new");
    await expect(copyBookingLink).toBeEnabled();
    await signOut.scrollIntoViewIfNeeded();
    await expect(signOut).toBeVisible();

    const closeButton = drawer.getByRole("button", { name: "Close" });
    const closeBox = await closeButton.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox!.width).toBeGreaterThanOrEqual(40);
    expect(closeBox!.height).toBeGreaterThanOrEqual(40);

    await closeButton.click();
    await expect(drawer).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test("settings tabs remain unclipped and keyboard-usable at 390 by 844", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDemoHost(page, "/settings");

    const tabList = page.getByRole("tablist", { name: "Settings sections" });
    const accountTab = tabList.getByRole("tab", { name: "Account" });
    const preferencesTab = tabList.getByRole("tab", { name: "Preferences" });
    const integrationsTab = tabList.getByRole("tab", { name: "Integrations" });

    await expect(tabList).toBeVisible();
    expect(
      await tabList.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1
      )
    ).toBe(true);

    await accountTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(preferencesTab).toBeFocused();
    await expect(accountTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(preferencesTab).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("heading", { name: "Display Preferences", level: 2 })
    ).toBeVisible();

    await page.keyboard.press("End");
    await expect(integrationsTab).toBeFocused();
    await page.keyboard.press("Space");
    await expect(integrationsTab).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("heading", { name: "Integrations", level: 2 })
    ).toBeVisible();
  });
});
