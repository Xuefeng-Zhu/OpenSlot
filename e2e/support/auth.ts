import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type Page } from "@playwright/test";
import { demoHost } from "../demo-data";
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
  const filePath = demoHostAuthStatePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  await page.context().storageState({ path: filePath });
}

async function restoreDemoHostAuthState(page: Page, returnUrl: string) {
  const filePath = demoHostAuthStatePath();
  if (!existsSync(filePath)) return false;

  try {
    const state = JSON.parse(readFileSync(filePath, "utf8")) as {
      cookies?: BrowserCookie[];
    };
    const cookies = Array.isArray(state.cookies) ? state.cookies : [];
    if (cookies.length === 0) return false;

    await page.context().addCookies(cookies);
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

function demoHostAuthStatePath() {
  return (
    process.env.E2E_DEMO_AUTH_STATE_FILE ??
    path.join(process.cwd(), "test-results", "e2e-demo-auth-state.json")
  );
}
