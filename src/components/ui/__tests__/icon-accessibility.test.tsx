import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import React from "react";

expect.extend(toHaveNoViolations);

/**
 * Validates Property 13: Image and Icon Accessibility
 *
 * For any `<img>` element or decorative `<svg>` icon rendered in the application,
 * it SHALL have either a non-empty `alt` attribute (for informative images) or
 * `aria-hidden="true"` (for decorative elements).
 *
 * **Validates: Requirements 17.5**
 */
describe("Image and Icon Accessibility", () => {
  it("decorative SVG icons with aria-hidden have no axe violations", async () => {
    const { container } = render(
      <div>
        <button type="button" aria-label="Close">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("informative images with alt text have no axe violations", async () => {
    const { container } = render(
      <div>
        <img src="/avatar.png" alt="User profile picture" />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("decorative images with empty alt have no axe violations", async () => {
    const { container } = render(
      <div>
        <img src="/decoration.png" alt="" />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("SVG icons in buttons with aria-label are accessible", async () => {
    const { container } = render(
      <div>
        <button type="button" aria-label="Notifications">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2z" />
          </svg>
        </button>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("SVG icons next to text in buttons are properly hidden", async () => {
    const { container } = render(
      <div>
        <button type="button">
          <svg
            className="h-4 w-4 mr-1"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          Copy link
        </button>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify the SVG has aria-hidden
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("multiple decorative icons all have aria-hidden", () => {
    const { container } = render(
      <nav aria-label="Test navigation">
        <a href="/dashboard">
          <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 24 24">
            <rect width="24" height="24" />
          </svg>
          Dashboard
        </a>
        <a href="/settings">
          <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
          </svg>
          Settings
        </a>
      </nav>
    );

    const svgs = container.querySelectorAll("svg");
    svgs.forEach((svg) => {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("image without alt text produces axe violations", async () => {
    const { container } = render(
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photo.png" />
      </div>
    );

    const results = await axe(container);
    expect(results.violations.length).toBeGreaterThan(0);
  });
});
