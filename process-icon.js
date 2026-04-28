/**
 * Converte electron/assets/icon-source.png em:
 *   - electron/assets/icon.png (256x256)
 *   - electron/assets/icon.ico (multi-tamanho com BMP nas pequenas
 *     — formato exigido pelo Windows pra icone embutido em .exe)
 */
const fs        = require('fs');
const path      = require('path');
const sharp     = require('sharp');
const pngToIco  = require('png-to-ico').default;

const SOURCE  = path.join(__dirname, 'electron', 'assets', 'icon-source.png');
const TMP_DIR = path.join(__dirname, '.icon-tmp');
const OUT_PNG = path.join(__dirname, 'electron', 'assets', 'icon.png');
const OUT_ICO = path.join(__dirname, 'electron', 'assets', 'icon.ico');

if (!fs.existsSync(SOURCE)) {
  console.error('✗ icon-source.png não encontrado em', SOURCE);
  process.exit(1);
}

(async () => {
  console.log('Lendo imagem source...');

  // Garante diretório temporário
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  // PNG 256x256 para tray e BrowserWindow
  await sharp(SOURCE)
    .resize(256, 256, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9 })
    .toFile(OUT_PNG);
  console.log('✓ PNG 256x256:', OUT_PNG);

  // Gera PNGs em cada tamanho que vai entrar no ICO
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const tmpPngs = [];
  for (const size of sizes) {
    const tmp = path.join(TMP_DIR, `icon-${size}.png`);
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png({ compressionLevel: 9 })
      .toFile(tmp);
    tmpPngs.push(tmp);
  }

  // png-to-ico converte cada PNG no formato correto (BMP/DIB para sizes < 256,
  // PNG só pra 256x256). Esse é o formato que Windows reconhece em .exe.
  const icoBuf = await pngToIco(tmpPngs);
  fs.writeFileSync(OUT_ICO, icoBuf);
  console.log(`✓ ICO multi-size: ${OUT_ICO} (${(icoBuf.length/1024).toFixed(1)} KB, formato Windows-compatible)`);

  // Limpa temporários
  for (const f of tmpPngs) fs.unlinkSync(f);
  fs.rmdirSync(TMP_DIR);

  console.log('\nPronto! Agora roda: npm run build');
})().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
