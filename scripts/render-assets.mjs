import sharp from "sharp";
import { writeFileSync } from "node:fs";
const colors = [
  "#8C7BFF",
  "#F39865",
  "#79C4A6",
  "#7EB5EE",
  "#ECA7C9",
  "#E8C874",
  "#A8A0F2",
  "#88BEBB",
  "#E9AA88",
];
const symbols = [
  '<path d="M35 53l13 13 28-31"/>',
  '<rect x="29" y="25" width="42" height="50" rx="6"/><path d="M39 39h22M39 51h4m12 0h6M39 63h4m12 0h6"/>',
  '<path d="M37 64V31l32-6v33M37 39l32-6"/><ellipse cx="29" cy="66" rx="9" ry="6"/><ellipse cx="61" cy="60" rx="9" ry="6"/>',
  '<circle cx="50" cy="50" r="24"/><path d="M50 34v18l12 7"/>',
  '<path d="M30 72V49m20 23V28m20 44V39"/>',
  '<path d="M50 22l7 20 21 8-21 8-7 20-7-20-21-8 21-8z"/>',
  '<rect x="27" y="25" width="46" height="52" rx="6"/><path d="M38 40h24M38 51h24M38 62h15"/>',
  '<rect x="24" y="29" width="52" height="43" rx="7"/><circle cx="60" cy="42" r="5"/><path d="M25 64l18-18 17 18 8-7 7 7"/>',
  '<path d="M50 73C15 51 25 24 42 35l8 8 8-8c17-11 27 16-8 38z"/>',
];
function tile(x, y, size, angle, color, symbol) {
  return `<g transform="translate(${x} ${y}) rotate(${angle})"><rect x="${
    -size / 2
  }" y="${-size / 2 + 12}" width="${size}" height="${size}" rx="${
    size * 0.24
  }" fill="#212038" opacity=".11" filter="url(#shadow)"/><rect x="${
    -size / 2
  }" y="${-size / 2}" width="${size}" height="${size}" rx="${
    size * 0.24
  }" fill="${color}"/><rect x="${-size / 2 + 2}" y="${-size / 2 + 2}" width="${
    size - 4
  }" height="${size - 4}" rx="${
    size * 0.24
  }" fill="url(#shine)"/><g transform="translate(${-size / 2} ${
    -size / 2
  }) scale(${
    size / 100
  })" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">${
    symbols[symbol % 9]
  }</g></g>`;
}
const defs = `<defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter><linearGradient id="shine" x2="0.8" y2="1"><stop stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><radialGradient id="bg"><stop stop-color="#FFFDF8"/><stop offset="1" stop-color="#EDEAF8"/></radialGradient></defs>`;
const positions = [
  [208, 182, 218, -14],
  [518, 185, 224, 8],
  [827, 166, 225, -9],
  [168, 505, 234, 11],
  [496, 500, 252, -8],
  [838, 498, 234, 14],
  [212, 825, 226, -10],
  [523, 825, 218, 12],
  [842, 826, 232, -8],
];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${defs}<rect width="1024" height="1024" fill="url(#bg)"/>${positions
  .map((p, i) => tile(...p, colors[i], i))
  .join("")}</svg>`;
writeFileSync("assets/icon.svg", svg);
await sharp(Buffer.from(svg)).png().toFile("assets/icon.png");
const hero = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="580">${defs}<rect width="1100" height="580" fill="#EDEBF9"/>${[
  [150, 230, 176, -17, 2],
  [400, 160, 190, 9, 0],
  [665, 210, 200, -11, 1],
  [932, 170, 164, 14, 4],
  [270, 450, 184, 10, 6],
  [570, 460, 185, -9, 3],
  [875, 450, 182, 14, 5],
]
  .map(([x, y, s, r, i]) => tile(x, y, s, r, colors[i], i))
  .join("")}</svg>`;
await sharp(Buffer.from(hero)).png().toFile("assets/hero.png");
writeFileSync(
  "app-store/design/asset-provenance.json",
  JSON.stringify(
    {
      method:
        "Original editable SVG artwork rendered with Sharp; no third-party icons or generated UI",
      icon: "assets/icon.svg",
      renderer: "scripts/render-assets.mjs",
    },
    null,
    2
  ) + "\n"
);
