/* global console */
import { dirname, resolve, basename } from "path";
import { fileURLToPath } from "url";
import {
  cp,
  mkdir,
  rm,
  readFile,
  writeFile,
  copyFile,
  stat,
} from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const distDir = resolve(projectRoot, "dist");
const manifestPath = resolve(projectRoot, "manifest.json");
const debugPath = resolve(projectRoot, "src/debug.js");
const mv2TemplatePath = resolve(__dirname, "templates/background-mv2.js");

async function ensureScannerBuild() {
  await import("./build-scanner.mjs");
}

async function resetDist() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
}

async function copyOptionalFile(source, destinationDir) {
  try {
    await copyFile(source, resolve(destinationDir, basename(source)));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function copyDirectory(source, destination) {
  try {
    const stats = await stat(source);
    if (!stats.isDirectory()) return;
    await cp(source, destination, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function writeManifest(targetDir, manifest) {
  await writeFile(
    resolve(targetDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
}

function transformToMv2Manifest(baseManifest) {
  const manifest = JSON.parse(JSON.stringify(baseManifest));
  manifest.manifest_version = 2;

  if (manifest.action) {
    manifest.browser_action = manifest.action;
    delete manifest.action;
  }

  delete manifest.side_panel;

  if (manifest.permissions) {
    manifest.permissions = manifest.permissions.filter(
      (permission) => permission !== "sidePanel" && permission !== "scripting"
    );
  }

  if (!Array.isArray(manifest.permissions)) {
    manifest.permissions = [];
  }

  if (Array.isArray(manifest.host_permissions)) {
    manifest.permissions = Array.from(
      new Set([...manifest.permissions, ...manifest.host_permissions])
    );
    delete manifest.host_permissions;
  }

  manifest.background = {
    scripts: ["src/background.js"],
    persistent: false,
  };

  if (Array.isArray(manifest.web_accessible_resources)) {
    const resources = manifest.web_accessible_resources.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (entry && Array.isArray(entry.resources)) return entry.resources;
      return [];
    });
    if (resources.length > 0) {
      manifest.web_accessible_resources = Array.from(new Set(resources));
    } else {
      delete manifest.web_accessible_resources;
    }
  }

  return manifest;
}

async function buildMv3(manifest) {
  const targetDir = resolve(distDir, "mv3");
  await mkdir(targetDir, { recursive: true });
  await copyDirectory(resolve(projectRoot, "icons"), resolve(targetDir, "icons"));
  await copyDirectory(resolve(projectRoot, "src"), resolve(targetDir, "src"));
  await copyOptionalFile(resolve(projectRoot, "favicon.ico"), targetDir);
  await copyOptionalFile(resolve(projectRoot, "test.html"), targetDir);
  await writeManifest(targetDir, manifest);
  console.info("Built MV3 package in dist/mv3");
}

async function buildMv2(baseManifest, debugValue) {
  const targetDir = resolve(distDir, "mv2");
  await mkdir(targetDir, { recursive: true });
  await copyDirectory(resolve(projectRoot, "icons"), resolve(targetDir, "icons"));
  await copyDirectory(resolve(projectRoot, "src"), resolve(targetDir, "src"));
  await copyOptionalFile(resolve(projectRoot, "favicon.ico"), targetDir);
  await copyOptionalFile(resolve(projectRoot, "test.html"), targetDir);

  const manifest = transformToMv2Manifest(baseManifest);
  await writeManifest(targetDir, manifest);

  const template = await readFile(mv2TemplatePath, "utf8");
  const backgroundCode = template.replace(/__DEBUG_VALUE__/g, debugValue);
  await writeFile(resolve(targetDir, "src/background.js"), backgroundCode);
  console.info("Built MV2 package in dist/mv2");
}

async function main() {
  await ensureScannerBuild();
  await resetDist();

  const baseManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const debugSource = await readFile(debugPath, "utf8");
  const debugMatch = debugSource.match(/DEBUG\s*=\s*([^;]+);/);
  const debugValue = debugMatch ? debugMatch[1].trim() : "false";

  await buildMv3(baseManifest);
  await buildMv2(baseManifest, debugValue);
}

await main();
