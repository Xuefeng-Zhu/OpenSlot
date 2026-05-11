/**
 * Copies text from client-side controls, falling back to a temporary textarea
 * for browsers that block or omit the async Clipboard API.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text) {
    throw new Error("Nothing to copy");
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue to the textarea fallback below.
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is unavailable");
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "-9999px";

  const selection = document.getSelection();
  const selectedRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const didCopy = document.execCommand("copy");
  textArea.remove();

  if (selection && selectedRange) {
    selection.removeAllRanges();
    selection.addRange(selectedRange);
  }

  if (!didCopy) {
    throw new Error("Clipboard copy failed");
  }
}
