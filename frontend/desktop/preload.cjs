const { contextBridge, ipcRenderer } = require("electron");

const apiBase = process.env.SMART_SUPERVISION_API_BASE || "http://127.0.0.1:8765";

contextBridge.exposeInMainWorld("smartWorkbench", {
  apiBase,
  desktop: {
    getStatus: () => ipcRenderer.invoke("desktop:get-status"),
    createBackup: () => ipcRenderer.invoke("desktop:create-backup"),
    retryStartup: () => ipcRenderer.invoke("desktop:retry-startup"),
    openPath: (targetPath) => ipcRenderer.invoke("desktop:open-path", targetPath),
  },
});
