import { type Page } from "@playwright/test";
import { demoHost } from "../demo-data";
import {
  hasBackendAuthCookie,
  mergeStoredBackendCookies,
  readDemoHostAuthState,
  writeDemoHostAuthState,
  type DemoHostAuthState,
} from "./auth-state";
import { expect } from "./test";

type BrowserCookie = Parameters<
  ReturnType<Page["context"]>["addCookies"]
>[0][number];

const AUTH_RESTORE_TIMEOUT_MS = 10_000;

export async function loginAsDemoHost(page: Page, returnUrl = "/dashboard") {
  if (await restoreDemoHostAuthState(page, returnUrl)) {
    return;
  }

  const params = new URLSearchParams({ returnUrl });
  const returnUrlPattern = new RegExp(`${escapeRegExp(returnUrl)}$`);

  await page.goto(`/login?${params.toString()}`);
  if (returnUrlPattern.test(page.url())) {
    await saveDemoHostAuthState(page);
    return;
  }

  await page.getByLabel("Email").fill(demoHost.email);
  await page.getByLabel("Password").fill(demoHost.password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(returnUrlPattern);
  await saveDemoHostAuthState(page);
}

export async function saveDemoHostAuthState(page: Page) {
  const state = (await page.context().storageState()) as DemoHostAuthState;
  writeDemoHostAuthState(mergeStoredBackendCookies(state));
}

async function restoreDemoHostAuthState(page: Page, returnUrl: string) {
  const state = readDemoHostAuthState();
  if (!state || !hasBackendAuthCookie(state)) return false;

  try {
    const cookies = Array.isArray(state.cookies) ? state.cookies : [];
    if (cookies.length === 0) return false;

    await page.context().addCookies(cookies as BrowserCookie[]);
    await page.goto(returnUrl);
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(returnUrl)}$`), {
      timeout: AUTH_RESTORE_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
