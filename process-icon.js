/**
 * Converte electron/assets/icon-source.png em:
 *   - electron/assets/icon.png (256x256)
 *   - electron/assets/icon.ico (multi-tamanho: 16, 32, 48, 64, 128, 256)
 *
 * Roda com: node process-icon.js
 */
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');
const zlib  = require('zlib');

const SOURCE = path.join(__dirname, 'electron', 'assets', 'icon-source.png');
const OUT_PNG = path.join(__dirname, 'electron', 'assets', 'icon.png');
const OUT_ICO = path.join(__dirname, 'electron', 'assets', 'icon.ico');

if (!fs.existsSync(SOURCE)) {
  console.error('✗ Arquivo não encontrado:', SOURCE);
  console.error('  Salve sua imagem como icon-source.png nesse caminho.');
  process.exit(1);
}

// ─── ICO writer (suporta PNG embutido) ───
async function writeIco(sizes, outPath) {
  // Para cada tamanho, gera buffer PNG redimensionado
  const entries = await Promise.all(sizes.map(async size => {
    const buf = await sharp(SOURCE)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { size, buf };
  }));

  // Header ICO: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(entries.length, 4); // count

  // Calcula offset (header + diretório de entradas)
  let offset = 6 + (entries.length * 16);

  // Tabela de entradas (16 bytes cada)
  const dirParts = [];
  const dataParts = [];
  for (const e of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(e.size === 256 ? 0 : e.size, 0);  // width (0 = 256)
    dir.writeUInt8(e.size === 256 ? 0 : e.size, 1);  // height
    dir.writeUInt8(0, 2);   // colors
    dir.writeUInt8(0, 3);   // reserved
    dir.writeUInt16LE(1, 4);  // planes
    dir.writeUInt16LE(32, 6); // bpp
    dir.writeUInt32LE(e.buf.length, 8);  // size
    dir.writeUInt32LE(offset, 12);       // offset
    dirParts.push(dir);
    dataParts.push(e.buf);
    offset += e.buf.length;
  }

  const final = Buffer.concat([header, ...dirParts, ...dataParts]);
  fs.writeFileSync(outPath, final);
  return final.length;
}

(async () => {
  console.log('Lendo imagem source...');

  // PNG 256x256 (usa cover crop pra ficar quadrado)
  await sharp(SOURCE)
    .resize(256, 256, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9 })
    .toFile(OUT_PNG);
  console.log('✓ PNG gerado:', OUT_PNG);

  // ICO com múltiplos tamanhos (Windows usa o tamanho ideal pra cada contexto)
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const icoSize = await writeIco(sizes, OUT_ICO);
  console.log('✓ ICO gerado:', OUT_ICO, `(${(icoSize/1024).toFixed(1)} KB, tamanhos: ${sizes.join(', ')})`);
  console.log('\nPronto! Agora roda: npm run build');
})().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
