import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { Input } from "../input";
import { Textarea } from "../textarea";
import { Label } from "../label";

expect.extend(toHaveNoViolations);

/**
 * Validates Property 12: Form Input Label Association
 *
 * For any form input element (`<input>`, `<textarea>`, `<select>`) rendered in
 * the application, it SHALL have either a `<label>` element with a matching
 * `htmlFor`/`id` pairing, or an `aria-label` attribute with a non-empty value.
 *
 * **Validates: Requirements 17.3**
 */
describe("Form Input Label Association", () => {
  it("Input with Label htmlFor has no axe violations", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="email-input">Email</Label>
        <Input id="email-input" type="email" placeholder="you@example.com" />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Input with aria-label has no axe violations", async () => {
    const { container } = render(
      <div>
        <Input type="search" aria-label="Search" placeholder="Search..." />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Textarea with Label htmlFor has no axe violations", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="notes-input">Notes</Label>
        <Textarea id="notes-input" placeholder="Enter notes..." />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Textarea with aria-label has no axe violations", async () => {
    const { container } = render(
      <div>
        <Textarea aria-label="Description" placeholder="Enter description..." />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("native select with Label htmlFor has no axe violations", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="timezone-select">Timezone</Label>
        <select id="timezone-select">
          <option value="America/New_York">America/New York</option>
          <option value="Europe/London">Europe/London</option>
        </select>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("native select with aria-label has no axe violations", async () => {
    const { container } = render(
      <div>
        <select aria-label="Choose timezone">
          <option value="America/New_York">America/New York</option>
          <option value="Europe/London">Europe/London</option>
        </select>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("complete form with proper labels has no axe violations", async () => {
    const { container } = render(
      <form>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" placeholder="Your name" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" />
        </div>
        <div>
          <Label htmlFor="message">Message</Label>
          <Textarea id="message" placeholder="Your message..." />
        </div>
      </form>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
