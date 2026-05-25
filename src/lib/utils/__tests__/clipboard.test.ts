import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "../clipboard";

describe("copyTextToClipboard", () => {
  const originalExecCommand = document.execCommand;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: originalExecCommand,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("restores focus to the source control after fallback copy succeeds", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Copy";
    document.body.appendChild(trigger);
    trigger.focus();

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => true),
    });

    await copyTextToClipboard("booking link");

    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("restores focus to the source control after fallback copy fails", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Copy";
    document.body.appendChild(trigger);
    trigger.focus();

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });

    await expect(copyTextToClipboard("booking link")).rejects.toThrow(
      "Clipboard copy failed"
    );

    expect(document.querySelector("textarea")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
