// Minimal Electron app used by the desktop testing example (tests/desktop/*.desktop.ts).
// Build-free (CommonJS `.cjs`, so it runs regardless of the project's package "type"): the main
// process just opens a window on the bundled index.html. Replace this with your own app in
// desktop/apps.ts once you're ready to test real software.
const path = require('path');
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Playwright AI Desktop Example',
    webPreferences: { contextIsolation: true },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Playwright closes the app at test end; quit on non-macOS as is conventional.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
