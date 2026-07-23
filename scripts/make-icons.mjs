/**
 * Generates the PWA app icons as solid PNGs — a brand-blue field with a white
 * droplet-like circle — with no external image libraries (pure zlib PNG
 * encoding). Run: `node scripts/make-icons.mjs`. Output goes to public-pwa/.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public-pwa');
mkdirSync(OUT, { recursive: true });

// Brand blue (#2563eb) background, white droplet.
const BG = [37, 99, 235];
const FG = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.3;
  // Raw image: each row prefixed with a filter byte (0 = none).
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      // Teardrop: circle with a pulled-up tip.
      const dx = x - cx;
      const dy = y - cy;
      const inCircle = dx * dx + dy * dy <= r * r;
      const inTip = Math.abs(dx) < (cy - y) * 0.5 && y < cy;
      const [R, G, B] = inCircle || inTip ? FG : BG;
      const off = y * stride + 1 + x * 3;
      raw[off] = R;
      raw[off + 1] = G;
      raw[off + 2] = B;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), makePng(size));
}
writeFileSync(join(OUT, 'apple-touch-icon.png'), makePng(180));
console.log('icons written to', OUT);
