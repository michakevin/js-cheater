/* global console */
import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sourcePath = resolve(__dirname, "../src/scanner-source.js");
const destPath = resolve(__dirname, "../src/popup/scanner-code.js");

const code = await readFile(sourcePath, "utf8");

const escaped = code.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const out = `export const SCANNER_CODE = \`\n${escaped}\`;\n`;

await writeFile(destPath, out);
console.info("Built scanner-code.js");
