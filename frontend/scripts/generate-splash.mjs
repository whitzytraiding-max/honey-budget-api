/**
 * Generates resources/splash.png (2732x2732) for Honey Budget.
 * Centers the app icon on the app's warm cream background.
 */
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const iconPath = join(root, "resources", "icon.png");
const splashPath = join(root, "resources", "splash.png");

const SPLASH_SIZE = 2732;
const ICON_SIZE = 1400; // large enough to look bold on screen
const BG_COLOR = { r: 254, g: 245, b: 238, alpha: 1 }; // matched to icon background

const icon = await sharp(iconPath)
  .resize(ICON_SIZE, ICON_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

await sharp({
  create: {
    width: SPLASH_SIZE,
    height: SPLASH_SIZE,
    channels: 4,
    background: BG_COLOR,
  },
})
  .composite([
    {
      input: icon,
      gravity: "center",
    },
  ])
  .png()
  .toFile(splashPath);

console.log(`✓ Splash screen generated: ${splashPath}`);
