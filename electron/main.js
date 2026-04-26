const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, shell, globalShortcut, screen
} = require('electron');
const path  = require('path');
const Store = require('electron-store');

const store = new Store();
const APP_URL = 'https://nosso-espaco-theta.vercel.app';
const isDev   = process.argv.includes('--dev');

let mainWindow = null;
let tray       = null;
let isQuitting = false;

// ─── Janela principal ────────────────────────────────────
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const winBounds = store.get('windowBounds', {
    width:  Math.min(1280, width),
    height: Math.min(860,  height),
    x: undefined,
    y: undefined,
  });

  mainWindow = new BrowserWindow({
    ...winBounds,
    minWidth:  900,
    minHeight: 620,
    frame: false,                   // sem barra do SO — usamos titlebar própria
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0a',
    title: 'nosso espaço',
    icon: iconPath(),
    show: false,                    // mostra só após carregar
    webPreferences: {
      preload:           path.join(__dirname, 'preload.js'),
      nodeIntegration:   false,
      contextIsolation:  true,
      spellcheck:        false,
    },
  });

  // Carrega o site remoto
  mainWindow.loadURL(APP_URL);

  // Injeta titlebar + CSS de integração assim que a página carregar
  mainWindow.webContents.on('did-finish-load', () => {
    injetarTitlebar();
    if (!mainWindow.isVisible()) mainWindow.show();
  });

  // Página falhou ao carregar (sem internet, etc.) → tenta de novo em 5s
  mainWindow.webContents.on('did-fail-load', (_, errCode, errDesc) => {
    if (errCode === -3) return; // ERR_ABORTED (navegação cancelada) — ignorar
    console.log('did-fail-load:', errCode, errDesc);
    setTimeout(() => mainWindow?.loadURL(APP_URL), 5000);
  });

  // Renderer travou ou crashou → reload automático
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.log('render-process-gone:', details.reason);
    if (details.reason !== 'clean-exit') {
      setTimeout(() => mainWindow?.loadURL(APP_URL), 1000);
    }
  });

  // Previne navegação para URLs fora do app (ex.: links externos)
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_URL)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Abre links target="_blank" no navegador padrão em vez de nova janela Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Salva posição/tamanho ao fechar
  mainWindow.on('close', e => {
    store.set('windowBounds', mainWindow.getBounds());
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

    /* Titlebar overlay de controles */
    #electron-controls {
      position: fixed;
      top: 0; right: 0;
      width: 130px;
      height: 46px;
      display: flex;
      align-items: stretch;
      z-index: 9999;
      -webkit-app-region: no-drag;
    }
    .ec-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.45);
      font-size: 13px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
      -webkit-app-region: no-drag;
      padding: 0;
    }
    .ec-btn:hover            { background: rgba(255,255,255,0.08); color: #fff; }
    .ec-btn.ec-close:hover   { background: #e81123 !important; color: #fff; }
    .ec-btn.ec-min svg,
    .ec-btn.ec-max svg,
    .ec-btn.ec-close svg { pointer-events: none; }
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
    { label: '✦ nosso espaço', enabled: false },
    { type:  'separator' },
    { label: 'Abrir',    click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Minimizar', click: () => mainWindow?.hide() },
    { type:  'separator' },
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

// ─── App lifecycle ────────────────────────────────────────
app.setName('nosso espaço');

// Impede múltiplas instâncias
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  app.whenReady().then(() => {
    // Restaura autoLaunch salvo
    if (store.get('autoLaunch', false)) {
      app.setLoginItemSettings({ openAtLogin: true, name: 'nosso espaço' });
    }

    createWindow();
    createTray();

    // Atalho global Ctrl+Shift+N para toggle
    globalShortcut.register('CommandOrControl+Shift+N', toggleWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow?.show();
    });
  });

  app.on('before-quit', () => { isQuitting = true; });
  app.on('will-quit',   () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Não fecha — vive na bandeja
    }
  });
}
