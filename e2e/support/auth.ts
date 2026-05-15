import { type Page } from "@playwright/test";
import { demoHost } from "../demo-data";
import { expect } from "./test";

export async function loginAsDemoHost(page: Page, returnUrl = "/dashboard") {
  const params = new URLSearchParams({ returnUrl });

  await page.goto(`/login?${params.toString()}`);
  await page.getByLabel("Email").fill(demoHost.email);
  await page.getByLabel("Password").fill(demoHost.password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(returnUrl)}$`));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
