/**
 * Gera um PNG 256x256 simples para o ícone do app.
 * Usa apenas módulos nativos do Node.js (zlib + Buffer).
 * Roda com: node generate-icon.js
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const SIZE = 256;

// ─── Helpers PNG ──────────────────────────────────────────
function crc32(buf) {
  let c = 0xffffffff;
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let j = 0; j < 8; j++) v = (v & 1) ? (0xedb88320 ^ (v >>> 1)) : (v >>> 1);
      t[i] = v;
    }
    return t;
  })();
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const crcBuf  = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePNG(width, height, pixelFn) {
  // RGBA raw data
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter type None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      raw.push(r, g, b, a);
    }
  }

  const IHDR = Buffer.alloc(13);
  IHDR.writeUInt32BE(width,  0);
  IHDR.writeUInt32BE(height, 4);
  IHDR[8]  = 8;  // bit depth
  IHDR[9]  = 6;  // color type RGBA
  IHDR[10] = 0; IHDR[11] = 0; IHDR[12] = 0;

  const compressed = zlib.deflateSync(Buffer.from(raw));

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG sig
    chunk('IHDR', IHDR),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Design do ícone ──────────────────────────────────────
// Paleta
const BG    = [10,  10,  10,  255]; // #0a0a0a
const GOLD  = [200, 184, 122, 255]; // #c8b87a
const LIGHT = [232, 232, 232, 255]; // #e8e8e8

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function dist(x, y, cx, cy) { return Math.sqrt((x-cx)**2 + (y-cy)**2); }

function pixelFn(x, y) {
  const cx = SIZE / 2, cy = SIZE / 2;
  const s = SIZE;

  // Fundo
  let r = BG[0], g = BG[1], b = BG[2], a = 255;

  // Borda dourada (4px)
  const bw = 5;
  const inBorder = x < bw || y < bw || x >= s - bw || y >= s - bw;
  if (inBorder) return GOLD;

  // Círculo central suave (glow fundo)
  const d = dist(x, y, cx, cy);
  if (d < 90) {
    const t = 1 - d / 90;
    r = lerp(r, 28, t);
    g = lerp(g, 22, t);
    b = lerp(b, 12, t);
  }

  // Estrelinhas ✦ decorativas (topo) — 3 pontos horizontais
  const starY = 72;
  const starPositions = [cx - 38, cx, cx + 38];
  for (const sx of starPositions) {
    // Cruz de 4 pontas (pixel art ✦)
    const dx = Math.abs(x - sx), dy = Math.abs(y - starY);
    if ((dx <= 1 && dy <= 7) || (dy <= 1 && dx <= 7) ||
        (dx === dy && dx <= 4)) {
      const fade = 1 - Math.max(dx, dy) / 7;
      r = lerp(r, GOLD[0], fade * 0.9);
      g = lerp(g, GOLD[1], fade * 0.9);
      b = lerp(b, GOLD[2], fade * 0.9);
    }
  }

  // Letras "ne" — desenhadas como formas geométricas
  // "n" — centrado em (cx-30, cy+10)
  const nX = cx - 34, nY = cy - 8, lH = 52, sw = 8;
  // Haste esquerda do "n"
  if (x >= nX && x < nX + sw && y >= nY && y < nY + lH) {
    const t = 1 - Math.min(Math.abs(x - nX - sw/2) / (sw/2), 1);
    r = lerp(r, LIGHT[0], t); g = lerp(g, LIGHT[1], t); b = lerp(b, LIGHT[2], t);
  }
  // Arco/haste direita do "n"
  const nRX = nX + 26;
  if (x >= nRX && x < nRX + sw && y >= nY + 14 && y < nY + lH) {
    const t = 1 - Math.min(Math.abs(x - nRX - sw/2) / (sw/2), 1);
    r = lerp(r, LIGHT[0], t); g = lerp(g, LIGHT[1], t); b = lerp(b, LIGHT[2], t);
  }
  // Topo curvo do "n" (barra horizontal)
  if (x >= nX && x < nRX + sw && y >= nY && y < nY + sw) {
    const t = 1 - Math.min(Math.abs(y - nY - sw/2) / (sw/2), 1);
    r = lerp(r, LIGHT[0], t * 0.85); g = lerp(g, LIGHT[1], t * 0.85); b = lerp(b, LIGHT[2], t * 0.85);
  }

  // "e" — centrado em (cx+20, cy+10)
  const eX = cx + 10, eY = nY, ew = 34;
  // Haste esquerda do "e"
  if (x >= eX && x < eX + sw && y >= eY && y < eY + lH) {
    const t = 1 - Math.min(Math.abs(x - eX - sw/2) / (sw/2), 1);
    r = lerp(r, LIGHT[0], t); g = lerp(g, LIGHT[1], t); b = lerp(b, LIGHT[2], t);
  }
  // Barra topo
  if (x >= eX && x < eX + ew && y >= eY && y < eY + sw) {
    const t = 1 - Math.min(Math.abs(y - eY - sw/2) / (sw/2), 1);
    r = lerp(r, LIGHT[0], t); g = lerp(g, LIGHT[1], t); b = lerp(b, LIGHT[2], t);
  }
  // Barra meio
  const eMidY = eY + Math.floor(lH / 2) - Math.floor(sw / 2);
  if (x >= eX && x < eX + ew - 6 && y >= eMidY && y < eMidY + sw) {
    const t = 1 - Math.min(Math.abs(y - eMidY - sw/2) / (sw/2), 1);
    r = lerp(r, LIGHT[0], t); g = lerp(g, LIGHT[1], t); b = lerp(b, LIGHT[2], t);
  }
  // Barra base
  if (x >= eX && x < eX + ew && y >= eY + lH - sw && y < eY + lH) {
    const t = 1 - Math.min(Math.abs(y - (eY + lH - sw) - sw/2) / (sw/2), 1);
    r = lerp(r, LIGHT[0], t); g = lerp(g, LIGHT[1], t); b = lerp(b, LIGHT[2], t);
  }

  // Estrelinhas (base)
  const starY2 = s - 72;
  for (const sx of starPositions) {
    const dx = Math.abs(x - sx), dy = Math.abs(y - starY2);
    if ((dx <= 1 && dy <= 7) || (dy <= 1 && dx <= 7) ||
        (dx === dy && dx <= 4)) {
      const fade = 1 - Math.max(dx, dy) / 7;
      r = lerp(r, GOLD[0], fade * 0.9);
      g = lerp(g, GOLD[1], fade * 0.9);
      b = lerp(b, GOLD[2], fade * 0.9);
    }
  }

  return [r, g, b, a];
}

// ─── Gera e salva ─────────────────────────────────────────
const outDir = path.join(__dirname, 'electron', 'assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const png = makePNG(SIZE, SIZE, pixelFn);
const outPath = path.join(outDir, 'icon.png');
fs.writeFileSync(outPath, png);
console.log('✓ Ícone gerado:', outPath, `(${(png.length / 1024).toFixed(1)} KB)`);
