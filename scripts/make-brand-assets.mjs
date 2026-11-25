// Builds the website's logo images and app icons from the master logo:
//   MyHomeCookin_Logo-StyleGuide/MyHomeCookin_Logo_Primary_Final.png
// Run from the project folder after the logo changes:
//   node scripts/make-brand-assets.mjs
//
// The master is on a white background. White is turned into transparency
// ("color to alpha", like GIMP's), so soft edges stay smooth on Cream.
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "MyHomeCookin_Logo-StyleGuide/MyHomeCookin_Logo_Primary_Final.png";
const CREAM = "#f8f1e9";

// Parts of the 784×1168 master (left, top, width, height), found by scanning
// for non-white rows: the house mark with steam and spoon, the "MyHome
// Cookin'" wordmark, and the whole stacked logo.
const PARTS = {
  mark: { left: 150, top: 14, width: 484, height: 618 },
  wordmark: { left: 96, top: 674, width: 600, height: 284 },
  full: { left: 76, top: 14, width: 632, height: 1080 },
};

async function transparent(region) {
  const { data, info } = await sharp(SOURCE)
    .extract(region)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    let a = Math.max(255 - r, 255 - g, 255 - b) / 255;
    if (a < 0.03) a = 0; // paper noise
    const un = (c) => (a === 0 ? 0 : Math.round(255 - (255 - c) / a));
    out[o] = un(r);
    out[o + 1] = un(g);
    out[o + 2] = un(b);
    out[o + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

// Layers of the house mark for the header animation (coordinates inside PARTS.mark).
// The steam floats above the spoon; the spoon sits above the chimney top.
export const LAYERS = {
  steam: { left: 362, top: 6, width: 74, height: 102 },
  spoon: { left: 352, top: 104, width: 86, height: 118 },
};

/** The mark split into base (spoon and steam erased), spoon and steam layers. */
async function markLayers() {
  const mark = await (await transparent(PARTS.mark)).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = mark.info;
  const base = Buffer.from(mark.data);
  for (const r of Object.values(LAYERS)) {
    for (let y = r.top; y < r.top + r.height; y++)
      for (let x = r.left; x < r.left + r.width; x++) base[(y * width + x) * channels + 3] = 0;
  }
  const raw = { raw: { width, height, channels } };
  const png = (img) => img.png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toBuffer();
  return {
    base: await png(sharp(base, raw)),
    spoon: await png(sharp(mark.data, raw).extract(LAYERS.spoon)),
    steam: await png(sharp(mark.data, raw).extract(LAYERS.steam)),
  };
}

/** The stacked logo (login page) with the spoon and steam erased; same layers sit on top. */
async function stackedBase() {
  const full = await (await transparent(PARTS.full)).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = full.info;
  const dx = PARTS.mark.left - PARTS.full.left;
  const dy = PARTS.mark.top - PARTS.full.top;
  for (const r of Object.values(LAYERS)) {
    for (let y = r.top + dy; y < r.top + dy + r.height; y++)
      for (let x = r.left + dx; x < r.left + dx + r.width; x++) full.data[(y * width + x) * channels + 3] = 0;
  }
  return sharp(full.data, { raw: { width, height, channels } })
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toBuffer();
}

/** A transparent logo part as a compact palette PNG (about a third of the size). */
async function web(region) {
  return (await transparent(region)).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toBuffer();
}

/** The house mark centered on a Cream square, taking up `fill` of the height. */
async function icon(size, fill) {
  const box = Math.round(size * fill);
  const mark = await (await transparent(PARTS.mark))
    .resize({ width: box, height: box, fit: "contain", background: "#0000" })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

const outputs = {
  // Website logos (transparent backgrounds), palette PNGs to keep them small
  "public/brand/logo-primary.png": await web(PARTS.full),
  "public/brand/logo-mark.png": await web(PARTS.mark),
  "public/brand/logo-wordmark.png": await web(PARTS.wordmark),
  ...(await markLayers().then((l) => ({
    "public/brand/logo-mark-base.png": l.base,
    "public/brand/logo-mark-spoon.png": l.spoon,
    "public/brand/logo-mark-steam.png": l.steam,
  }))),
  "public/brand/logo-primary-base.png": await stackedBase(),
  // App icons
  "public/icons/icon-192.png": await icon(192, 0.88),
  "public/icons/icon-512.png": await icon(512, 0.88),
  "public/icons/icon-maskable-512.png": await icon(512, 0.68), // Android circle-crop safe zone
  "src/app/apple-icon.png": await icon(180, 0.86),
  "src/app/icon1.png": await icon(64, 0.94), // browser tab
};
for (const [path, buf] of Object.entries(outputs)) {
  await writeFile(path, buf);
  const m = await sharp(buf).metadata();
  console.log(`wrote ${path} (${m.width}×${m.height})`);
}
