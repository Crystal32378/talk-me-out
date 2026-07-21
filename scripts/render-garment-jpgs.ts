import sharp from "sharp";
import { readFile } from "fs/promises";

const garments = [
  "sequin-dress",
  "beige-coat",
  "running-jacket",
  "designer-tee",
  "blazer",
  "cashmere-wrap",
];

(async () => {
  for (const id of garments) {
    const svg = await readFile(`/home/z/my-project/public/garments/${id}.svg`);
    const png = await sharp(svg).png().toBuffer();
    await sharp(png)
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toFile(`/home/z/my-project/public/garments/${id}.jpg`);
    console.log(`Wrote ${id}.jpg`);
  }
})();
