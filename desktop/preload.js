const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loginToVinted: () => ipcRenderer.send('vinted-login'),
  onLoginSuccess: (callback) => ipcRenderer.on('login-success', (_event, value) => callback(value)),
});
