// Builds the app icons from the brand icon (public/brand/icon.svg).
// Run after changing the logo:  node scripts/make-icons.mjs
import { readFile, writeFile, copyFile } from "node:fs/promises";
import sharp from "sharp";

const CREAM = "#f8f1e9";
const svg = await readFile("public/brand/icon.svg");

/** The mark centered on a cream square, taking up `fill` of the width. */
async function icon(size, fill) {
  const mark = await sharp(svg, { density: 600 })
    .resize(Math.round(size * fill), Math.round(size * fill), { fit: "contain", background: "#0000" })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

const outputs = {
  "public/icons/icon-192.png": await icon(192, 0.9),
  "public/icons/icon-512.png": await icon(512, 0.9),
  // Android crops maskable icons to a circle: keep the mark in the safe zone.
  "public/icons/icon-maskable-512.png": await icon(512, 0.7),
  // iOS home screen (rounds the corners itself).
  "src/app/apple-icon.png": await icon(180, 0.86),
  // Small fallback favicon for browsers without SVG favicon support.
  "src/app/icon1.png": await icon(48, 0.96),
};
for (const [path, buf] of Object.entries(outputs)) {
  await writeFile(path, buf);
  console.log("wrote", path);
}
// Browser tab icon (SVG stays crisp at any size).
await copyFile("public/brand/icon.svg", "src/app/icon2.svg");
console.log("wrote src/app/icon2.svg");
