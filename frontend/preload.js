const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process via window.oxnet
contextBridge.exposeInMainWorld('oxnet', {
  // Backend API calls routed through main process (bypasses CSP)
  getDevices: () => ipcRenderer.invoke('get-devices'),
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  createSession: (data) => ipcRenderer.invoke('create-session', data),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});