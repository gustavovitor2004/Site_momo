/**
 * Converte icon.png → icon.ico (PNG embutido, formato ICO válido)
 * Suportado por Windows Vista+ e pelo NSIS 3+
 */
const fs   = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, 'electron', 'assets', 'icon.png');
const icoPath = path.join(__dirname, 'electron', 'assets', 'icon.ico');

const pngData = fs.readFileSync(pngPath);

// ICO header (6 bytes)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);  // reserved
header.writeUInt16LE(1, 2);  // type = 1 (icon)
header.writeUInt16LE(1, 4);  // number of images = 1

// Directory entry (16 bytes)
const dir = Buffer.alloc(16);
dir.writeUInt8(0,            0); // width  (0 = 256)
dir.writeUInt8(0,            1); // height (0 = 256)
dir.writeUInt8(0,            2); // color count (0 = true color)
dir.writeUInt8(0,            3); // reserved
dir.writeUInt16LE(1,         4); // planes
dir.writeUInt16LE(32,        6); // bits per pixel
dir.writeUInt32LE(pngData.length, 8);  // size of image data
dir.writeUInt32LE(6 + 16,   12); // offset (header + 1 dir entry)

const ico = Buffer.concat([header, dir, pngData]);
fs.writeFileSync(icoPath, ico);
console.log('✓ icon.ico gerado:', icoPath, `(${(ico.length / 1024).toFixed(1)} KB)`);
