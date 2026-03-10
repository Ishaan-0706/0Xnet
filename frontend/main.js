const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Handle Squirrel events for Windows installer — MUST be first
if (require('electron-squirrel-startup')) app.quit();

const API_BASE = 'http://localhost:8080';

// ── Create main window ──
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 550,
    backgroundColor: '#000003',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);

  // Open DevTools in dev mode
  win.webContents.openDevTools();

  win.loadFile(path.join(__dirname, 'Index.html')).catch(err => {
    console.error('Failed to load Index.html:', err);
  });
}

// ── IPC Handlers ──
// Route API calls through the main process so renderer CSP doesn't block them

ipcMain.handle('get-devices', async () => {
  try {
    const data = await fetchJSON(`${API_BASE}/devices`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-sessions', async () => {
  try {
    const data = await fetchJSON(`${API_BASE}/session/list`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('create-session', async (_event, body) => {
  try {
    const data = await fetchJSON(`${API_BASE}/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// ── Helper: fetch JSON using Node's built-in fetch (Electron 28+) ──
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── App lifecycle ──
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
