import { app, BrowserWindow } from 'electron'

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  await window.loadURL(process.env.ELECTRON_TEST_URL || 'http://127.0.0.1:4173')
})

app.on('window-all-closed', () => {
  app.quit()
})
