import { access, copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
const manifestByTarget = {
  chrome: "manifest.chrome.json",
  firefox: "manifest.firefox.json",
};

if (!manifestByTarget[target]) {
  console.error("Usage: node scripts/use-manifest.mjs <chrome|firefox>");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourceManifest = path.join(repoRoot, manifestByTarget[target]);
const destinationManifest = path.join(repoRoot, "manifest.json");

try {
  await access(sourceManifest);
  await copyFile(sourceManifest, destinationManifest);
  const writtenManifest = JSON.parse(
    await readFile(destinationManifest, "utf8"),
  );

  console.log(
    `Switched manifest.json to ${manifestByTarget[target]} (manifest_version ${writtenManifest.manifest_version}).`,
  );
} catch (error) {
  console.error(
    `Failed to switch manifest for "${target}": ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
