// Generates apps/web/public/og.png (1200×630): a radar frame of the trailer seed plus the brand.
// Pure JS rasteriser (areas are rectangles) + zlib PNG encoder; runs on every web build.
import { execSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'og-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(
  entry,
  `export { MAP01, Rng, generateBotMatchup, simulateMatch } from '${root}/packages/engine/src/index.ts';
   export { snapshot } from '${root}/apps/web/src/match/positions.ts';
   export { indexRounds } from '${root}/apps/web/src/match/replay.ts';`,
);
execSync(`npx esbuild "${entry}" --bundle --platform=node --format=esm --log-level=warning --alias:@idle-strike/engine=${root}/packages/engine/src/index.ts --outfile="${tmp}/bundle.mjs"`, { cwd: root, stdio: 'inherit' });
const { MAP01, Rng, generateBotMatchup, simulateMatch, snapshot, indexRounds } = await import(pathToFileURL(join(tmp, 'bundle.mjs')).href);

const SEED = 4; // same as Landing.TRAILER_SEED
const T = 30; // round 1, mid-execute: dots spread over the map
const log = simulateMatch({ map: MAP01, teams: generateBotMatchup(new Rng(SEED), 50, 50) }, SEED);
const ri = indexRounds(log)[0];
const snap = snapshot(log, MAP01, ri, T);

const W = 1200, H = 630;
const px = new Uint8Array(W * H * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = { bg: hex('#0c0f13'), area: hex('#1b222b'), site: hex('#23293a'), line: hex('#33404e'), ct: hex('#4c9df7'), t: hex('#f0a13a'), accent: hex('#ff6a1f'), text: hex('#eef2f6'), muted: hex('#aeb8c3') };
const put = (x, y, c, a = 1) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = px[i] * (1 - a) + c[0] * a;
  px[i + 1] = px[i + 1] * (1 - a) + c[1] * a;
  px[i + 2] = px[i + 2] * (1 - a) + c[2] * a;
  px[i + 3] = 255;
};
const rect = (x0, y0, x1, y1, c, a = 1) => { for (let y = Math.max(0, y0 | 0); y < Math.min(H, y1 | 0); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(W, x1 | 0); x++) put(x, y, c, a); };
const circle = (cx, cy, r, c, a = 1) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x | 0, y | 0, c, a); };
rect(0, 0, W, H, C.bg);

// Radar on the right: 560px square, faded.
const size = 600, ox = W - size - 40, oy = (H - size) / 2, k = size / MAP01.radar.w;
const sites = new Set([MAP01.sites.A.plant, MAP01.sites.B.plant]);
for (const a of MAP01.areas) {
  const xs = a.polygon.map((p) => p[0]), ys = a.polygon.map((p) => p[1]);
  const x0 = ox + Math.min(...xs) * k, y0 = oy + Math.min(...ys) * k, x1 = ox + Math.max(...xs) * k, y1 = oy + Math.max(...ys) * k;
  rect(x0, y0, x1, y1, sites.has(a.id) ? C.site : C.area, 0.9);
  rect(x0, y0, x1, y0 + 1, C.line); rect(x0, y1 - 1, x1, y1, C.line); rect(x0, y0, x0 + 1, y1, C.line); rect(x1 - 1, y0, x1, y1, C.line);
}
for (const p of snap.players) {
  const c = p.side === 'CT' ? C.ct : C.t;
  const x = ox + p.x * k, y = oy + p.y * k;
  if (p.alive) circle(x, y, 9, c);
  else { for (let d = -8; d <= 8; d++) { put((x + d) | 0, (y + d) | 0, c, 0.8); put((x + d) | 0, (y - d) | 0, c, 0.8); put((x + d + 1) | 0, (y + d) | 0, c, 0.8); put((x + d + 1) | 0, (y - d) | 0, c, 0.8); } }
}
// Left gradient so the text reads.
for (let x = 0; x < W; x++) { const a = Math.max(0, 1 - x / 760); for (let y = 0; y < H; y++) put(x, y, C.bg, a * 0.85); }

// 5x7 pixel font for the brand + tagline.
const F = {
  I: ['11111','00100','00100','00100','00100','00100','11111'], D: ['11110','10001','10001','10001','10001','10001','11110'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], S: ['01111','10000','10000','01110','00001','00001','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  R: ['11110','10001','10001','11110','10100','10010','10001'], K: ['10001','10010','10100','11000','10100','10010','10001'], '2': ['01110','10001','00001','00010','00100','01000','11111'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'], C: ['01110','10001','10000','10000','10000','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  A: ['01110','10001','10001','11111','10001','10001','10001'], Q: ['01110','10001','10001','10001','10101','10010','01101'], U: ['10001','10001','10001','10001','10001','10001','01110'],
  N: ['10001','11001','10101','10011','10001','10001','10001'], O: ['01110','10001','10001','10001','10001','10001','01110'], V: ['10001','10001','10001','10001','10001','01010','00100'],
  B: ['11110','10001','10001','11110','10001','10001','11110'], M: ['10001','11011','10101','10101','10001','10001','10001'], '.': ['00000','00000','00000','00000','00000','01100','01100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'], G: ['01110','10001','10000','10111','10001','10001','01111'],
  Ê: ['01010','00000','11111','10000','11110','10000','11111'], 'Ã': ['01010','10100','01110','10001','11111','10001','10001'], H: ['10001','10001','10001','11111','10001','10001','10001'],
};
const text = (s, x, y, cell, c) => { let cx = x; for (const ch of s) { const g = F[ch] ?? F[' ']; for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === '1') rect(cx + q * cell, y + r * cell, cx + (q + 1) * cell, y + (r + 1) * cell, c); cx += 6 * cell; } };
text('IDLE STRIKE 2', 60, 150, 10, C.accent);
text('CS PRA QUANDO', 60, 260, 8, C.text);
text('VOCÊ NÃO PODE', 60, 330, 8, C.text);
text('ABRIR O CS.', 60, 400, 8, C.text);
text('BROWSERSTRIKE2.VERCEL.APP', 60, 520, 4, C.muted);

// PNG encode.
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k2 = 0; k2 < 8; k2++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const out = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(join(root, 'apps/web/public/og.png'), out);
console.log(`og.png ${W}x${H} (${(out.length / 1024).toFixed(0)} KB) · seed ${SEED} t=${T}`);
