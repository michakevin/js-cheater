/* global console */
import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sourcePath = resolve(__dirname, "../src/scanner-source.js");
const corePath = resolve(__dirname, "../src/scanner-core.js");
const parsePathFile = resolve(__dirname, "../src/parse-path.js");
const destPath = resolve(__dirname, "../src/popup/scanner-code.js");
let sourceCode = await readFile(sourcePath, "utf8");
let coreCode = await readFile(corePath, "utf8");

let parsePath = await readFile(parsePathFile, "utf8");
parsePath = parsePath.replace(/^export\s+/, "").trim();
// Escape backslashes for embedding in a template literal
parsePath = parsePath.replace(/\\/g, "\\\\");

// remove import line referencing parse-path.js in core
coreCode = coreCode.replace(
  /^import\s+\{\s*parsePath\s*\}\s+from\s+"\.\/parse-path\.js";\n/m,
  ""
);

// insert parsePath function after the utility comment in core
const insertMarker = /(^\s*\/\/ Path parsing utility function)/m;
const indentedParsePath =
  parsePath
    .split("\n")
    .map((l) => "  " + l)
    .join("\n");
coreCode = coreCode.replace(insertMarker, `$1\n${indentedParsePath}`);

// make createScanner a regular function in the bundled code
coreCode = coreCode.replace(
  /^export\s+(function\s+createScanner)/m,
  '$1'
);

// remove import line referencing scanner-core.js in source
sourceCode = sourceCode.replace(
  /^import\s+\{\s*createScanner\s*\}\s+from\s+"\.\/scanner-core\.js";\n/m,
  ""
);

const combined = coreCode + "\n" + sourceCode;
const escaped = combined.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const out = `export const SCANNER_CODE = \`\n${escaped}\`;\n`;

await writeFile(destPath, out);
console.info("Built scanner-code.js");
