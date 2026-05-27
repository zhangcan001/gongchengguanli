const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const frontendRoot = path.join(repoRoot, "frontend");
const electronDist = path.join(frontendRoot, "node_modules", "electron", "dist");
const backendExe = path.join(repoRoot, "backend", "dist", "smart-supervision-backend.exe");
const outputDir = path.join(frontendRoot, "release", "win-unpacked");
const appDir = path.join(outputDir, "resources", "app");

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} 不存在：${targetPath}`);
  }
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(from);
      fs.symlinkSync(linkTarget, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

assertExists(path.join(electronDist, "electron.exe"), "Electron 运行时");
assertExists(path.join(frontendRoot, "dist", "index.html"), "前端 build 产物");
assertExists(backendExe, "后端 exe");

fs.rmSync(outputDir, { recursive: true, force: true });
copyDir(electronDist, outputDir);

const brandedExe = path.join(outputDir, "智能工程监理工作台.exe");
fs.renameSync(path.join(outputDir, "electron.exe"), brandedExe);

copyDir(path.join(frontendRoot, "dist"), path.join(appDir, "dist"));
copyDir(path.join(frontendRoot, "desktop"), path.join(appDir, "desktop"));
copyFile(path.join(frontendRoot, "package.json"), path.join(appDir, "package.json"));
copyFile(backendExe, path.join(outputDir, "resources", "backend", "smart-supervision-backend.exe"));

console.log(`桌面端解包版已生成：${brandedExe}`);
