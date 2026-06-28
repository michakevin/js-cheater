import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { escapeForTemplate } from "./escape-template.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sourcePath = resolve(__dirname, "../src/scanner-source.js");
const corePath = resolve(__dirname, "../src/scanner-core.js");
const parsePathFile = resolve(__dirname, "../src/parse-path.js");
const galleryUnlockerFile = resolve(__dirname, "../src/gallery-unlocker.js");
const debugPath = resolve(__dirname, "../src/debug.js");
const destPath = resolve(__dirname, "../src/popup/scanner-code.js");
let sourceCode = await readFile(sourcePath, "utf8");
let coreCode = await readFile(corePath, "utf8");
const debugSource = await readFile(debugPath, "utf8");
const debugMatch = debugSource.match(/DEBUG\s*=\s*([^;]+);/);
const debugValue = debugMatch ? debugMatch[1].trim() : "false";

let parsePath = await readFile(parsePathFile, "utf8");
parsePath = parsePath.replace(/^export\s+/, "").trim();
// Note: backslashes are escaped uniformly for the whole combined source below
// (see the `escaped` step), so no per-file escaping is needed here.

// remove import line referencing parse-path.js in core
coreCode = coreCode.replace(
  /^import\s+\{\s*parsePath\s*\}\s+from\s+"\.\/parse-path\.js";\r?\n/m,
  "",
);

// insert parsePath function after the utility comment in core
const insertMarker = /(^\s*\/\/ Path parsing utility function)/m;
const indentedParsePath = parsePath
  .split("\n")
  .map((l) => "  " + l)
  .join("\n");
coreCode = coreCode.replace(insertMarker, `$1\n${indentedParsePath}`);

// Inline gallery-unlocker.js: strip BUILD_STRIP markers and `export`
// keywords, then drop the corresponding import in scanner-core.
let galleryUnlocker = await readFile(galleryUnlockerFile, "utf8");
galleryUnlocker = galleryUnlocker
  .replace(/\/\*\s*BUILD_STRIP_START\s*\*\/[\s\S]*?\/\*\s*BUILD_STRIP_END\s*\*\//g, "")
  .replace(/^export\s+/gm, "")
  .trim();

coreCode = coreCode.replace(
  /^import\s+\{[^}]+\}\s+from\s+"\.\/gallery-unlocker\.js";\r?\n/m,
  "",
);

const indentedGallery = galleryUnlocker
  .split("\n")
  .map((l) => "  " + l)
  .join("\n");
coreCode = coreCode.replace(insertMarker, `$1\n${indentedGallery}\n`);

// make createScanner a regular function in the bundled code
coreCode = coreCode.replace(/^export\s+(function\s+createScanner)/m, "$1");

// remove import line referencing scanner-core.js in source
sourceCode = sourceCode.replace(
  /^import\s+\{\s*createScanner\s*\}\s+from\s+"\.\/scanner-core\.js";\r?\n/m,
  "",
);

sourceCode = sourceCode.replace(
  /const\s+BUILD_DEBUG\s*=\s*[^;]+;/,
  `const BUILD_DEBUG = ${debugValue};`,
);

const combined = coreCode + "\n" + sourceCode;
const escaped = escapeForTemplate(combined);

const out = `export const SCANNER_CODE = \`\n${escaped}\`;\n`;

await writeFile(destPath, out);
console.info("Built scanner-code.js");
