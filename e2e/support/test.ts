import { expect, test as base, type Page } from "@playwright/test";

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, runTest) => {
    const browserErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        browserErrors.push(message.text());
      }
    });

    page.on("pageerror", (error) => {
      browserErrors.push(error.message);
    });

    await runTest(page);

    expect(browserErrors, "browser console and uncaught page errors").toEqual(
      []
    );
  },
});

export { expect };

export async function expectVisibleText(page: Page, text: string | RegExp) {
  await expect
    .poll(async () => {
      const matches = page.getByText(text);
      const count = await matches.count();

      for (let index = 0; index < count; index += 1) {
        if (await matches.nth(index).isVisible()) {
          return true;
        }
      }

      return false;
    })
    .toBe(true);
}
