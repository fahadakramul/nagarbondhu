const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

const crcTable = makeCrcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const toCrc = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([lenBuf, toCrc, crcBuf]);
}

function createPng(width, height, getPixel) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', idatData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Draw a rounded card / shield / emblem on teal #0F766E
function getIconPixel(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background teal: #0F766E (15, 118, 110)
  const bg = [15, 118, 110, 255];
  // Gold accent: #F59E0B (245, 158, 11)
  const gold = [245, 158, 11, 255];
  // Pure white: #FFFFFF
  const white = [255, 255, 255, 255];

  // Outer circle border
  const radius = w * 0.38;
  if (Math.abs(dist - radius) < w * 0.015) {
    return gold;
  }

  // Inner icon: Stylized citizen / building shape
  // Main central building tower
  const nx = (x - cx) / (w * 0.5);
  const ny = (y - cy) / (h * 0.5);

  // Center vertical tower
  if (Math.abs(nx) < 0.18 && ny > -0.4 && ny < 0.35) {
    // Windows in tower
    if (Math.sin(ny * 25) > 0.4 && Math.abs(nx) < 0.12) {
      return gold;
    }
    return white;
  }

  // Left building
  if (nx > -0.38 && nx < -0.18 && ny > -0.15 && ny < 0.35) {
    return [240, 240, 240, 255];
  }

  // Right building
  if (nx > 0.18 && nx < 0.38 && ny > -0.25 && ny < 0.35) {
    return [240, 240, 240, 255];
  }

  // Ground base
  if (Math.abs(nx) < 0.45 && ny >= 0.35 && ny <= 0.42) {
    return gold;
  }

  // AI Sparkle / Star at top
  const starDist = Math.sqrt((nx - 0.25) * (nx - 0.25) + (ny + 0.42) * (ny + 0.42));
  if (starDist < 0.05) {
    return gold;
  }

  return bg;
}

// Foreground pixel for adaptive icon (transparent background)
function getAdaptiveForegroundPixel(x, y, w, h) {
  const pixel = getIconPixel(x, y, w, h);
  // If background teal, make it transparent
  if (pixel[0] === 15 && pixel[1] === 118 && pixel[2] === 110) {
    return [0, 0, 0, 0];
  }
  return pixel;
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('Generating icon.png (1024x1024)...');
fs.writeFileSync(path.join(assetsDir, 'icon.png'), createPng(1024, 1024, getIconPixel));

console.log('Generating adaptive-icon.png (1024x1024)...');
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), createPng(1024, 1024, getAdaptiveForegroundPixel));

console.log('Generating splash.png (1242x2436)...');
fs.writeFileSync(path.join(assetsDir, 'splash.png'), createPng(1242, 2436, (x, y, w, h) => {
  // Center 600x600 icon
  const cx = w / 2;
  const cy = h / 2;
  const iconSize = 600;
  if (Math.abs(x - cx) < iconSize / 2 && Math.abs(y - cy) < iconSize / 2) {
    const ix = (x - (cx - iconSize / 2)) * (1024 / iconSize);
    const iy = (y - (cy - iconSize / 2)) * (1024 / iconSize);
    return getIconPixel(ix, iy, 1024, 1024);
  }
  return [15, 118, 110, 255];
}));

console.log('Generating favicon.png (48x48)...');
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), createPng(48, 48, (x, y, w, h) => {
  return getIconPixel(x * (1024 / 48), y * (1024 / 48), 1024, 1024);
}));

console.log('All assets successfully generated in', assetsDir);
