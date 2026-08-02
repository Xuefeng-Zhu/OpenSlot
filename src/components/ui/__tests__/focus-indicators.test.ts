import { describe, it, expect } from "vitest";
import { buttonVariants } from "../button";

/**
 * Validates Property 7: Focus Indicator Presence
 *
 * For any interactive component in the component library (Button, Input, Select,
 * Switch, Textarea, link elements), the component's class list SHALL include
 * focus-visible ring styling (`focus-visible:ring-2 focus-visible:ring-ring`).
 *
 * **Validates: Requirements 2.16, 17.2**
 */
describe("Focus Indicator Presence", () => {
  describe("Button", () => {
    it("includes focus-visible:ring-2 in base classes", () => {
      const classes = buttonVariants({ variant: "default", size: "default" });
      expect(classes).toContain("focus-visible:ring-2");
    });

    it("includes focus-visible:ring-ring in base classes", () => {
      const classes = buttonVariants({ variant: "default", size: "default" });
      expect(classes).toContain("focus-visible:ring-ring");
    });

    it("includes focus-visible:ring-offset-2 in base classes", () => {
      const classes = buttonVariants({ variant: "default", size: "default" });
      expect(classes).toContain("focus-visible:ring-offset-2");
    });

    it("includes focus-visible:outline-none in base classes", () => {
      const classes = buttonVariants({ variant: "default", size: "default" });
      expect(classes).toContain("focus-visible:outline-none");
    });

    it("preserves focus indicators across all variants", () => {
      const variants = [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ] as const;

      for (const variant of variants) {
        const classes = buttonVariants({ variant, size: "default" });
        expect(classes).toContain("focus-visible:ring-2");
        expect(classes).toContain("focus-visible:ring-ring");
      }
    });
  });

  describe("Input", () => {
    it("includes focus-visible ring classes in component definition", async () => {
      // Read the Input component's default className from the module
      const inputModule = await import("../input");
      // The Input component applies classes via cn() - we verify the source includes them
      // by rendering and checking the output
      const { render } = await import("@testing-library/react");
      const { createElement } = await import("react");

      const { container } = render(
        createElement(inputModule.Input, { type: "text", "aria-label": "test" })
      );
      const input = container.querySelector("input");
      expect(input?.className).toContain("focus-visible:ring-2");
      expect(input?.className).toContain("focus-visible:ring-ring");
      expect(input?.className).toContain("focus-visible:ring-offset-2");
      expect(input?.className).toContain("border-input");
      expect(input?.className).toContain("placeholder:text-muted-foreground");
      expect(input?.className).not.toContain("placeholder:text-muted-foreground/80");
    });
  });

  describe("Textarea", () => {
    it("includes focus-visible ring classes in component definition", async () => {
      const textareaModule = await import("../textarea");
      const { render } = await import("@testing-library/react");
      const { createElement } = await import("react");

      const { container } = render(
        createElement(textareaModule.Textarea, { "aria-label": "test" })
      );
      const textarea = container.querySelector("textarea");
      expect(textarea?.className).toContain("focus-visible:ring-2");
      expect(textarea?.className).toContain("focus-visible:ring-ring");
      expect(textarea?.className).toContain("focus-visible:ring-offset-2");
      expect(textarea?.className).toContain("border-input");
      expect(textarea?.className).toContain("placeholder:text-muted-foreground");
      expect(textarea?.className).not.toContain("placeholder:text-muted-foreground/80");
    });
  });

  describe("Switch", () => {
    it("includes focus-visible ring classes in component definition", async () => {
      const switchModule = await import("../switch");
      const { render } = await import("@testing-library/react");
      const { createElement } = await import("react");

      const { container } = render(
        createElement(switchModule.Switch, { "aria-label": "test toggle" })
      );
      const button = container.querySelector('[role="switch"]');
      expect(button?.className).toContain("focus-visible:ring-2");
      expect(button?.className).toContain("focus-visible:ring-ring");
      expect(button?.className).toContain("focus-visible:ring-offset-2");
      expect(button?.className).toContain("bg-input");
    });
  });

  describe("Select (SelectTrigger)", () => {
    it("includes focus ring classes in component definition", async () => {
      const selectModule = await import("../select");
      const { render } = await import("@testing-library/react");
      const { createElement } = await import("react");

      const { container } = render(
        createElement(
          selectModule.Select,
          null,
          createElement(
            selectModule.SelectTrigger,
            { "aria-label": "test select" },
            createElement(selectModule.SelectValue, {
              placeholder: "Select...",
            })
          )
        )
      );
      const trigger = container.querySelector('[role="combobox"]');
      expect(trigger?.className).toContain("focus:ring-2");
      expect(trigger?.className).toContain("focus:ring-ring");
      expect(trigger?.className).toContain("border-input");
      expect(trigger?.className).toContain(
        "data-[placeholder]:text-muted-foreground"
      );
      expect(trigger?.className).toContain("hover:border-primary");
    });
  });
});
