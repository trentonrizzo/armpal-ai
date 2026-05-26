import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "assets/branding/armpal-icon-master.png");

const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeSquareIcon(size, dest) {
  await ensureDir(path.dirname(dest));
  await sharp(SOURCE)
    .resize(size, size, {
      fit: "contain",
      background: BLACK,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(dest);
}

async function writeSplash(size, dest, logoScale = 0.46) {
  await ensureDir(path.dirname(dest));
  const logoSize = Math.round(size * logoScale);
  const logo = await sharp(SOURCE)
    .resize(logoSize, logoSize, {
      fit: "contain",
      background: BLACK,
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BLACK,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(dest);
}

const iosIcons = [
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-20@1x.png", 20],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-20@2x.png", 40],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-20@3x.png", 60],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-29@1x.png", 29],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-29@2x.png", 58],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-29@3x.png", 87],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-40@1x.png", 40],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-40@2x.png", 80],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-40@3x.png", 120],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-60@2x.png", 120],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-60@3x.png", 180],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-76@1x.png", 76],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-76@2x.png", 152],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-83.5@2x.png", 167],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/Icon-1024.png", 1024],
];

const webIcons = [
  ["public/pwa-192x192.png", 192],
  ["public/pwa-512x512.png", 512],
  ["public/apple-touch-icon.png", 180],
];

const splashFiles = [
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
];

async function writeFavicon() {
  const tmpDir = path.join(ROOT, ".tmp-branding");
  await ensureDir(tmpDir);
  const sizes = [16, 32, 48];
  const pngPaths = [];

  for (const size of sizes) {
    const file = path.join(tmpDir, `favicon-${size}.png`);
    await writeSquareIcon(size, file);
    pngPaths.push(file);
  }

  const ico = await pngToIco(pngPaths);
  await fs.writeFile(path.join(ROOT, "public/favicon.ico"), ico);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

async function main() {
  const meta = await sharp(SOURCE).metadata();
  if (meta.width !== meta.height) {
    throw new Error(`Master icon must be square. Got ${meta.width}x${meta.height}.`);
  }

  console.log(`Generating branding assets from ${SOURCE} (${meta.width}x${meta.height})`);

  for (const [rel, size] of [...iosIcons, ...webIcons]) {
    const dest = path.join(ROOT, rel);
    await writeSquareIcon(size, dest);
    console.log(`  ✓ ${rel} (${size}x${size})`);
  }

  for (const rel of splashFiles) {
    const dest = path.join(ROOT, rel);
    await writeSplash(2732, dest);
    console.log(`  ✓ ${rel} (2732x2732 splash)`);
  }

  await writeFavicon();
  console.log("  ✓ public/favicon.ico");

  console.log("Branding generation complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
