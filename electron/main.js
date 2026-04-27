const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, shell, globalShortcut, screen, dialog
} = require('electron');
const path  = require('path');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

const store   = new Store();
const APP_URL  = 'https://nosso-espaco-theta.vercel.app'; // usado só para links externos
const APP_FILE = path.join(__dirname, '..', 'index.html'); // carregado localmente
const isDev    = process.argv.includes('--dev');

let mainWindow = null;
let tray       = null;
let isQuitting = false;
let showTimer  = null;   // fallback para mostrar janela mesmo sem did-finish-load

// ─── Valida bounds salvos (evita janela fora da tela) ────
function getBoundsValidados() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  const saved = store.get('windowBounds');
  const defaultBounds = {
    width:  Math.min(1280, sw),
    height: Math.min(860,  sh),
    x: Math.round((sw - Math.min(1280, sw)) / 2),
    y: Math.round((sh - Math.min(860,  sh)) / 2),
  };

  if (!saved) return defaultBounds;

  // Garante tamanho mínimo razoável
  const w = Math.max(900, Math.min(saved.width  || defaultBounds.width,  sw));
  const h = Math.max(620, Math.min(saved.height || defaultBounds.height, sh));

  // Garante que a janela está dentro da área visível do monitor
  const x = (saved.x != null && saved.x >= -50 && saved.x < sw - 100)
    ? saved.x : defaultBounds.x;
  const y = (saved.y != null && saved.y >= 0   && saved.y < sh - 50)
    ? saved.y : defaultBounds.y;

  return { width: w, height: h, x, y };
}

// ─── Janela principal ────────────────────────────────────
function createWindow() {
  const bounds = getBoundsValidados();

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth:  900,
    minHeight: 620,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0a',
    title: 'nosso espaço',
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,
      contextIsolation: true,
      spellcheck:       false,
    },
  });

  // Maximiza por padrão (usuário pode restaurar se quiser)
  mainWindow.maximize();

  // Carrega index.html empacotado localmente
  mainWindow.loadFile(APP_FILE);
  mainWindow.show();

  // Injeta titlebar quando a página carregar
  mainWindow.webContents.on('did-finish-load', () => {
    injetarTitlebar();
  });

  // Renderer crashou → recarrega o arquivo local
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    if (details.reason === 'clean-exit') return;
    setTimeout(() => mainWindow?.loadFile(APP_FILE), 1000);
  });

  // Links externos (http/https) → abre no browser, não navega dentro do app
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Links target="_blank" → browser externo
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Salva posição/tamanho ao fechar (só se janela estiver visível e com tamanho válido)
  mainWindow.on('close', e => {
    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      const b = mainWindow.getBounds();
      if (b.width >= 900 && b.height >= 620) {
        store.set('windowBounds', b);
      }
    }
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (store.get('firstHide', true)) {
        store.set('firstHide', false);
        tray && tray.displayBalloon({
          iconType: 'info',
          title: 'nosso espaço',
          content: 'O app continua rodando na bandeja. Clique para reabrir.',
        });
      }
    }
  });

  mainWindow.on('maximize',   () => mainWindow.webContents.send('maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('maximized', false));
  mainWindow.on('focus',      () => mainWindow.webContents.send('focused',   true));
  mainWindow.on('blur',       () => mainWindow.webContents.send('focused',   false));

  if (isDev) mainWindow.webContents.openDevTools();
}

// ─── Titlebar injetado no site ────────────────────────────
function injetarTitlebar() {
  if (!mainWindow) return;

  mainWindow.webContents.insertCSS(`
    /* Draggable region */
    header {
      -webkit-app-region: drag !important;
      padding-right: 130px !important;   /* espaço pros botões */
    }
    header button,
    header input,
    header a,
    header .profile-pill,
    header .theme-toggle,
    nav { -webkit-app-region: no-drag !important; }

    /* Titlebar overlay de controles — discretos, tema do site */
    #electron-controls {
      position: fixed;
      top: 0; right: 0;
      height: 56px; /* alinha com altura do header */
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 0 14px;
      z-index: 9999;
      -webkit-app-region: no-drag;
      opacity: 0.35;
      transition: opacity 0.18s ease;
    }
    #electron-controls:hover { opacity: 1; }
    body.window-blurred #electron-controls { opacity: 0.18; }

    /* Empurra os botões da tela de login pra esquerda dos controles do Electron */
    .login-controls { right: 130px !important; -webkit-app-region: no-drag !important; }
    .login-ctrl-btn { -webkit-app-region: no-drag !important; }
    .ec-btn {
      width: 26px; height: 26px;
      background: transparent;
      border: 1px solid transparent;
      color: rgba(200,184,122,0.55);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.14s, color 0.14s, border-color 0.14s;
      -webkit-app-region: no-drag;
      padding: 0;
      border-radius: 2px;
    }
    .ec-btn:hover {
      background: rgba(200,184,122,0.1);
      color: rgba(200,184,122,1);
      border-color: rgba(200,184,122,0.35);
    }
    .ec-btn.ec-close:hover {
      background: rgba(232,17,35,0.12);
      color: #ff5060;
      border-color: rgba(232,17,35,0.45);
    }
    .ec-btn svg { pointer-events: none; }
    body.window-blurred header { opacity: 0.7; }
  `);

  mainWindow.webContents.executeJavaScript(`
    (function () {
      if (document.getElementById('electron-controls')) return;

      const ctrl = document.createElement('div');
      ctrl.id = 'electron-controls';
      ctrl.innerHTML = \`
        <button class="ec-btn ec-min"   title="Minimizar">
          <svg width="12" height="1" viewBox="0 0 12 1" fill="currentColor"><rect width="12" height="1"/></svg>
        </button>
        <button class="ec-btn ec-max"   title="Maximizar">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1">
            <rect x=".55" y=".55" width="8.9" height="8.9"/>
          </svg>
        </button>
        <button class="ec-btn ec-close" title="Fechar">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.2">
            <line x1="1" y1="1" x2="10" y2="10"/><line x1="10" y1="1" x2="1" y2="10"/>
          </svg>
        </button>
      \`;
      document.body.appendChild(ctrl);

      ctrl.querySelector('.ec-min').addEventListener('click',   () => window.electronAPI.minimize());
      ctrl.querySelector('.ec-max').addEventListener('click',   () => window.electronAPI.maximize());
      ctrl.querySelector('.ec-close').addEventListener('click', () => window.electronAPI.close());

      // Atualiza ícone max/restore
      window.electronAPI.onMaximized(v => {
        const icon = ctrl.querySelector('.ec-max');
        icon.title = v ? 'Restaurar' : 'Maximizar';
        icon.querySelector('svg').innerHTML = v
          ? \`<polyline points="3,0 10,0 10,7" stroke="currentColor" stroke-width="1.1" fill="none"/>
             <rect x="0" y="3" width="7" height="7" stroke="currentColor" stroke-width="1.1" fill="none"/>\`
          : \`<rect x=".55" y=".55" width="8.9" height="8.9" stroke="currentColor" stroke-width="1.1" fill="none"/>\`;
      });

      window.electronAPI.onFocused(v => {
        document.body.classList.toggle('window-blurred', !v);
      });
    })();
  `);
}

// ─── System Tray ─────────────────────────────────────────
function createTray() {
  const ico = iconPath();
  const img = ico
    ? nativeImage.createFromPath(ico).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(img);
  tray.setToolTip('nosso espaço');
  atualizarMenuTray();

  tray.on('click',        () => toggleWindow());
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function atualizarMenuTray() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: `✦ nosso espaço · v${app.getVersion()}`, enabled: false },
    { type:  'separator' },
    { label: 'Abrir',    click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Minimizar', click: () => mainWindow?.hide() },
    { type:  'separator' },
    {
      label: 'Verificar atualização',
      click: () => {
        if (isDev) return;
        autoUpdater.checkForUpdates().then(result => {
          if (!result || !result.updateInfo || result.updateInfo.version === app.getVersion()) {
            tray && tray.displayBalloon({
              iconType: 'info', title: 'nosso espaço',
              content: `Você já está na última versão (${app.getVersion()}).`,
            });
          }
        }).catch(() => {});
      }
    },
    {
      label:   'Iniciar com o Windows',
      type:    'checkbox',
      checked: store.get('autoLaunch', false),
      click(item) {
        store.set('autoLaunch', item.checked);
        app.setLoginItemSettings({ openAtLogin: item.checked, name: 'nosso espaço' });
      }
    },
    { type:  'separator' },
    { label: 'Sair', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ─── IPC handlers ─────────────────────────────────────────
ipcMain.on('window-minimize',  () => mainWindow?.minimize());
ipcMain.on('window-maximize',  () => mainWindow?.isMaximized() ? mainWindow.restore() : mainWindow?.maximize());
ipcMain.on('window-close',     () => mainWindow?.hide());
ipcMain.on('open-external',    (_, url) => shell.openExternal(url));
ipcMain.handle('is-maximized', () => mainWindow?.isMaximized() ?? false);

// ─── Helpers ─────────────────────────────────────────────
function iconPath() {
  const candidates = [
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(__dirname, 'assets', 'icon.png'),
  ];
  const fs = require('fs');
  return candidates.find(p => fs.existsSync(p)) || null;
}

// ─── Auto-update via GitHub Releases ─────────────────────
function setupAutoUpdate() {
  if (isDev) return; // não checa em dev

  autoUpdater.autoDownload = true;        // baixa automaticamente
  autoUpdater.autoInstallOnAppQuit = true; // instala ao sair
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('error', (err) => {
    console.log('[updater] erro:', err && err.message);
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] versão disponível:', info.version);
    // notifica usuário discretamente via balão da bandeja
    tray && tray.displayBalloon({
      iconType: 'info',
      title: 'nosso espaço — atualização disponível',
      content: `Versão ${info.version} está sendo baixada em segundo plano.`,
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] já está na última versão');
  });

  autoUpdater.on('download-progress', (p) => {
    console.log(`[updater] download: ${Math.round(p.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] update baixado:', info.version);
    // pergunta se quer instalar agora ou ao fechar
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Reiniciar agora', 'Mais tarde'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização pronta',
      message: `Versão ${info.version} baixada.`,
      detail: 'Quer reiniciar agora para aplicar a atualização?',
      noLink: true,
    }).then(result => {
      if (result.response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall();
      }
      // se "Mais tarde", instala automaticamente ao fechar (autoInstallOnAppQuit)
    });
  });

  // Checagem inicial após 4s (deixa o app abrir bem antes)
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);

  // Re-checa a cada 2 horas (caso o app fique aberto por dias)
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 2 * 60 * 60 * 1000);
}

// ─── App lifecycle ────────────────────────────────────────
app.setName('nosso espaço');

// ─── Fix tela preta: desabilita GPU compositing ───────────
// Chromium/Electron em algumas GPUs/drivers Windows causa tela preta
// com aceleração de hardware habilitada. Este app não precisa de GPU.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Impede múltiplas instâncias
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });

  app.whenReady().then(() => {
    // Restaura autoLaunch salvo
    if (store.get('autoLaunch', false)) {
      app.setLoginItemSettings({ openAtLogin: true, name: 'nosso espaço' });
    }

    createWindow();
    createTray();
    setupAutoUpdate();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else { mainWindow?.show(); mainWindow?.focus(); }
    });
  });

  app.on('before-quit', () => { isQuitting = true; });
  app.on('will-quit',   () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => {
    // Não fecha — vive na bandeja (exceto macOS que é padrão)
    if (process.platform === 'darwin') app.quit();
  });
}
