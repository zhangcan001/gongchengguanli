const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const net = require("net");

const APP_TITLE = "智能工程监理工作台";
const PORT = Number(process.env.SMART_SUPERVISION_PORT || 8765);
const HOST = "127.0.0.1";

let mainWindow = null;
let backendProcess = null;
let backendReady = false;
let backendError = "";
let dataDir = "";

function userDataDir() {
  const appDataRoot = process.env.APPDATA || app.getPath("appData");
  return path.join(appDataRoot, APP_TITLE, "data");
}

function ensureDataDirectories(root) {
  [
    "db",
    path.join("files", "uploads"),
    path.join("files", "exports"),
    path.join("files", "archive"),
    path.join("templates", "word"),
    path.join("templates", "excel"),
    "backups",
    "logs",
  ].forEach((relativePath) => {
    fs.mkdirSync(path.join(root, relativePath), { recursive: true });
  });
}

function sanitizeLogMessage(message) {
  return String(message).replace(/(api[_-]?key|authorization|token)(\s*[:=]\s*)(\S+)/gi, "$1$2***");
}

function logLine(message) {
  try {
    fs.mkdirSync(path.join(dataDir, "logs"), { recursive: true });
    fs.appendFileSync(
      path.join(dataDir, "logs", "desktop-shell.log"),
      `${new Date().toISOString()} ${sanitizeLogMessage(message)}\n`,
      "utf8",
    );
  } catch {
    // Logging must never block startup.
  }
}

function resolveBackendExecutable() {
  const resourceExe = path.join(process.resourcesPath, "backend", "smart-supervision-backend.exe");
  if (app.isPackaged && fs.existsSync(resourceExe)) {
    return { command: resourceExe, args: [], cwd: path.dirname(resourceExe) };
  }

  const repoRoot = path.resolve(__dirname, "..", "..");
  const python = process.env.SMART_SUPERVISION_PYTHON || path.join(repoRoot, "backend", ".venv", "Scripts", "python.exe");
  return {
    command: fs.existsSync(python) ? python : "python",
    args: ["desktop_server.py"],
    cwd: path.join(repoRoot, "backend"),
  };
}

function startBackend() {
  const backend = resolveBackendExecutable();
  const env = {
    ...process.env,
    SMART_SUPERVISION_DATA_DIR: dataDir,
    SMART_SUPERVISION_HOST: HOST,
    SMART_SUPERVISION_PORT: String(PORT),
  };

  backendProcess = spawn(backend.command, backend.args, {
    cwd: backend.cwd,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (chunk) => logLine(`[backend] ${chunk.toString().trim()}`));
  backendProcess.stderr.on("data", (chunk) => logLine(`[backend:error] ${chunk.toString().trim()}`));
  backendProcess.on("error", (error) => {
    backendError = error.message;
    logLine(`[backend:spawn-error] ${error.stack || error.message}`);
    showStartupError(error.message);
  });
  backendProcess.on("exit", (code, signal) => {
    if (!app.isQuitting && !backendReady) {
      backendError = `本地服务启动失败，退出码 ${code ?? "unknown"}，信号 ${signal ?? "none"}`;
      showStartupError(backendError);
    }
    logLine(`[backend:exit] code=${code ?? ""} signal=${signal ?? ""}`);
  });
}

function isPortInUse(timeoutMs = 700) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const socket = net.createConnection({ host: HOST, port: PORT, timeout: timeoutMs }, () => {
      socket.end();
      done(true);
    });
    socket.on("error", () => done(false));
    socket.on("timeout", () => {
      socket.destroy();
      done(false);
    });
  });
}

function waitForHealth(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: HOST, port: PORT, timeout: 900 }, () => {
        socket.end();
        fetch(`http://${HOST}:${PORT}/api/health`)
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
          .then(() => resolve())
          .catch((error) => {
            if (Date.now() > deadline) {
              reject(error);
            } else {
              setTimeout(attempt, 500);
            }
          });
      });
      socket.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error("本地服务启动超时。"));
        } else {
          setTimeout(attempt, 500);
        }
      });
      socket.on("timeout", () => {
        socket.destroy();
      });
    };
    attempt();
  });
}

function startupHtml(status, detail = "") {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${APP_TITLE}</title>
  <style>
    body {
      margin: 0;
      height: 100vh;
      display: grid;
      place-items: center;
      color: #e7f7ff;
      font-family: "Microsoft YaHei", system-ui, sans-serif;
      background:
        radial-gradient(circle at 22% 18%, rgba(43, 168, 255, 0.28), transparent 30%),
        radial-gradient(circle at 78% 22%, rgba(30, 232, 214, 0.18), transparent 28%),
        linear-gradient(135deg, #06101d, #071a2d 48%, #0a1728);
    }
    .card {
      width: min(560px, calc(100vw - 48px));
      border: 1px solid rgba(92, 211, 255, 0.28);
      border-radius: 22px;
      padding: 34px;
      background: rgba(11, 27, 48, 0.78);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32), inset 0 0 44px rgba(43, 168, 255, 0.08);
      backdrop-filter: blur(18px);
    }
    h1 { margin: 0 0 16px; font-size: 30px; letter-spacing: 0; }
    p { margin: 10px 0 0; color: #9fc1d8; line-height: 1.7; }
    .scan {
      overflow: hidden;
      height: 5px;
      margin-top: 26px;
      border-radius: 99px;
      background: rgba(255, 255, 255, 0.08);
    }
    .scan span {
      display: block;
      width: 42%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #2ba8ff, #1ee8d6);
      animation: move 1.1s ease-in-out infinite alternate;
      box-shadow: 0 0 18px rgba(30, 232, 214, 0.45);
    }
    .error { color: #ffb4c0; overflow-wrap: anywhere; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 22px; }
    button {
      min-height: 38px;
      border: 1px solid rgba(92, 211, 255, 0.36);
      border-radius: 12px;
      padding: 0 16px;
      color: #e7f7ff;
      background: linear-gradient(135deg, rgba(43, 168, 255, 0.34), rgba(30, 232, 214, 0.18));
      cursor: pointer;
    }
    @keyframes move { from { transform: translateX(0); } to { transform: translateX(145%); } }
  </style>
</head>
<body>
  <section class="card">
    <h1>${APP_TITLE}</h1>
    <p>${status}</p>
    <p>正在加载工作台...</p>
    ${detail ? `<p class="error">${detail}</p>` : ""}
    ${detail ? `<div class="actions"><button onclick="window.smartWorkbench?.desktop?.retryStartup?.()">重试启动本地服务</button></div>` : ""}
    <div class="scan"><span></span></div>
  </section>
</body>
</html>`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: APP_TITLE,
    show: false,
    backgroundColor: "#07111f",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(startupHtml("正在启动本地服务..."))}`);
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

function showStartupError(detail) {
  if (!mainWindow) {
    return;
  }
  mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      startupHtml("后端启动失败，请检查 data/logs/desktop-backend.log。", detail),
    )}`,
  );
}

async function bootstrapBackend() {
  backendReady = false;
  backendError = "";
  stopBackend();
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(startupHtml("正在启动本地服务..."))}`);
  if (await isPortInUse()) {
    backendError = `本地服务端口 ${PORT} 已被占用，请关闭其他智能工程监理工作台窗口，或设置 SMART_SUPERVISION_PORT 后重新启动。`;
    logLine(`[desktop:port-in-use] ${backendError}`);
    showStartupError(backendError);
    dialog.showErrorBox(APP_TITLE, backendError);
    return;
  }
  startBackend();
  try {
    await waitForHealth();
    backendReady = true;
    await loadFrontend();
  } catch (error) {
    backendError = error.message;
    logLine(`[desktop:error] ${error.stack || error.message}`);
    showStartupError(error.message);
    dialog.showErrorBox(APP_TITLE, `本地服务启动失败：${error.message}`);
  }
}

async function loadFrontend() {
  const indexHtml = path.join(__dirname, "..", "dist", "index.html");
  if (!fs.existsSync(indexHtml)) {
    throw new Error(`前端资源不存在：${indexHtml}`);
  }
  await mainWindow.loadFile(indexHtml);
}

async function createBackup() {
  ensureDataDirectories(dataDir);
  const backupDir = path.join(dataDir, "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz`);
  await tarDirectory(dataDir, backupPath);
  return { backupPath, dataDir };
}

function tarDirectory(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const args = ["-czf", outputPath, "--exclude=./backups", "--exclude=backups", "-C", sourceDir, "."];
    const tar = spawn("tar", args, { windowsHide: true });
    tar.on("error", reject);
    tar.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`备份失败，tar 退出码 ${code}`));
      }
    });
  });
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    const backendPid = backendProcess.pid;
    try {
      if (process.platform === "win32" && backendPid) {
        spawnSync("taskkill", ["/PID", String(backendPid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } else {
        backendProcess.kill("SIGTERM");
      }
    } catch (error) {
      logLine(`[backend:stop-error] ${error.message}`);
      try {
        backendProcess.kill("SIGKILL");
      } catch {
        // Nothing else to do during app shutdown.
      }
    } finally {
      backendProcess = null;
    }
  }
}

ipcMain.handle("desktop:get-status", () => ({
  backendReady,
  backendError,
  apiBase: `http://${HOST}:${PORT}`,
  dataDir,
}));

ipcMain.handle("desktop:create-backup", async () => createBackup());
ipcMain.handle("desktop:retry-startup", async () => bootstrapBackend());

ipcMain.handle("desktop:open-path", async (_event, targetPath) => {
  if (!targetPath || typeof targetPath !== "string") {
    return { ok: false, message: "路径为空。" };
  }
  const result = await shell.openPath(targetPath);
  return { ok: result === "", message: result };
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopBackend();
});

app.on("window-all-closed", () => {
  stopBackend();
  app.quit();
});

process.on("exit", () => {
  stopBackend();
});

app.whenReady().then(async () => {
  app.setName(APP_TITLE);
  dataDir = process.env.SMART_SUPERVISION_DATA_DIR || userDataDir();
  process.env.SMART_SUPERVISION_API_BASE = `http://${HOST}:${PORT}`;
  ensureDataDirectories(dataDir);
  logLine("[desktop] starting");
  createWindow();
  await bootstrapBackend();
});
