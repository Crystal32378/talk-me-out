import sharp from "sharp";
import { writeFileSync } from "fs";

const svg = `<svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5f5f0"/>
      <stop offset="100%" stop-color="#d8d8d2"/>
    </linearGradient>
  </defs>
  <rect width="768" height="1024" fill="url(#bg)"/>
  <g fill="#3a3a3a">
    <ellipse cx="384" cy="200" rx="90" ry="105"/>
    <rect x="364" y="290" width="40" height="50"/>
    <path d="M 230 380 Q 280 340 384 340 Q 488 340 538 380 L 558 620 L 210 620 Z"/>
    <path d="M 230 380 L 180 400 L 170 620 L 220 620 Z"/>
    <path d="M 538 380 L 588 400 L 598 620 L 548 620 Z"/>
  </g>
  <path d="M 300 180 Q 384 100 468 180 Q 460 130 384 110 Q 308 130 300 180 Z" fill="#2c2c2e"/>
  <g stroke="#1a1a1a" stroke-width="3" fill="none">
    <circle cx="350" cy="195" r="4" fill="#1a1a1a"/>
    <circle cx="418" cy="195" r="4" fill="#1a1a1a"/>
    <path d="M 360 235 Q 384 250 408 235"/>
  </g>
  <text x="384" y="780" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#8e8e93" letter-spacing="3">SAMPLE PERSON PHOTO</text>
</svg>`;

(async () => {
  const buf = await sharp(Buffer.from(svg))
    .flatten({ background: "#f5f5f0" })
    .jpeg({ quality: 90 })
    .toBuffer();
  writeFileSync("/home/z/my-project/public/sample-person.jpg", buf);
  console.log("Wrote /home/z/my-project/public/sample-person.jpg");
})();
