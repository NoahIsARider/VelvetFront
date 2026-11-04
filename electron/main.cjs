const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
let window

function createWindow() {
  window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1024,
    minHeight: 576,
    backgroundColor: '#17111f',
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) window.loadURL('http://127.0.0.1:5173')
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.on('window:minimize', () => window?.minimize())
ipcMain.on('window:toggle-maximize', () => window?.isMaximized() ? window.unmaximize() : window?.maximize())
ipcMain.on('window:close', () => window?.close())

app.whenReady().then(createWindow)
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
