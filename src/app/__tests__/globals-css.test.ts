import fs from "node:fs/promises";
import path from "node:path";

import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";

describe("global Tailwind styles", () => {
  it("compile through the Tailwind PostCSS plugin", async () => {
    const from = path.join(process.cwd(), "src/app/globals.css");
    const source = await fs.readFile(from, "utf8");

    const result = await postcss([tailwindcss()]).process(source, { from });

    expect(result.css).toContain("border-color: hsl(var(--border))");
  });
});
