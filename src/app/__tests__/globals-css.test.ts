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

  it("keeps the light input boundary at or above 3:1 contrast", async () => {
    const from = path.join(process.cwd(), "src/app/globals.css");
    const source = await fs.readFile(from, "utf8");
    const inputHsl = readFirstHslToken(source, "--input");
    const backgroundHsl = readFirstHslToken(source, "--background");
    const cardHsl = readFirstHslToken(source, "--card");

    expect(
      contrastRatio(hslToRgb(inputHsl), hslToRgb(backgroundHsl))
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(hslToRgb(inputHsl), hslToRgb(cardHsl))
    ).toBeGreaterThanOrEqual(3);
  });
});

function readFirstHslToken(source: string, token: string): [number, number, number] {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(`${escapedToken}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`)
  );

  if (!match) {
    throw new Error(`Missing HSL token: ${token}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function hslToRgb([hue, saturationPercent, lightnessPercent]: [
  number,
  number,
  number,
]): [number, number, number] {
  const saturation = saturationPercent / 100;
  const lightness = lightnessPercent / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = lightness - chroma / 2;
  const [red, green, blue] =
    sector < 1
      ? [chroma, x, 0]
      : sector < 2
        ? [x, chroma, 0]
        : sector < 3
          ? [0, chroma, x]
          : sector < 4
            ? [0, x, chroma]
            : sector < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return [red, green, blue].map((channel) => (channel + offset) * 255) as [
    number,
    number,
    number,
  ];
}

function contrastRatio(first: [number, number, number], second: [number, number, number]) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(rgb: [number, number, number]) {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
