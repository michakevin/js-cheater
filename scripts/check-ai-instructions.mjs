#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const copilotPath = resolve(".github", "copilot-instructions.md");
const agentsPath = resolve("AGENTS.md");

const errors = [];

if (!existsSync(copilotPath)) {
  errors.push(`Missing required file: ${copilotPath}`);
}
if (!existsSync(agentsPath)) {
  errors.push(`Missing required file: ${agentsPath}`);
}

const copilotText = existsSync(copilotPath)
  ? readFileSync(copilotPath, "utf8")
  : "";
const agentsText = existsSync(agentsPath)
  ? readFileSync(agentsPath, "utf8")
  : "";

if (copilotText) {
  const lineCount = copilotText.split(/\r?\n/).length;
  const charCount = copilotText.length;
  const maxLines = 60;
  const maxChars = 2000;

  if (lineCount > maxLines || charCount > maxChars) {
    errors.push(
      `Copilot file is not thin enough: ${lineCount} lines, ${charCount} chars (max ${maxLines} lines and ${maxChars} chars).`
    );
  }
}

const combined = `${copilotText}\n${agentsText}`;
if (/^<{7}|^={7}|^>{7}/m.test(combined)) {
  errors.push("Conflict markers found (<<<<<<<, =======, >>>>>>>). Resolve merge leftovers.");
}

const normalized = combined.toLowerCase();
const hasNpm = /\bnpm\s+(install|ci|run|test)\b/.test(normalized) || /\buse\s+npm\b/.test(normalized);
const hasPnpm = /\bpnpm\s+(install|add|run|test|dlx)\b/.test(normalized) || /\buse\s+pnpm\b/.test(normalized);
const hasYarn = /\byarn\s+(install|add|run|test)\b/.test(normalized) || /\buse\s+yarn\b/.test(normalized);

if (hasNpm && hasPnpm) {
  errors.push("Conflicting package manager guidance detected: npm and pnpm.");
}
if (hasNpm && hasYarn) {
  errors.push("Conflicting package manager guidance detected: npm and yarn.");
}
if (hasPnpm && hasYarn) {
  errors.push("Conflicting package manager guidance detected: pnpm and yarn.");
}

if (agentsText) {
  const requiredSections = [
    { name: "Setup", pattern: /^##\s*Setup\b/im },
    { name: "Commands", pattern: /^##\s*Commands\b/im },
    { name: "Repo Map", pattern: /^##\s*Repo Map\b/im },
    { name: "Do-Don't", pattern: /^##\s*Do-Don't\b/im },
    { name: "Definition of Done", pattern: /^##\s*Definition of Done\b/im },
    { name: "Boundaries", pattern: /^##\s*Boundaries\b/im },
  ];

  for (const section of requiredSections) {
    if (!section.pattern.test(agentsText)) {
      errors.push(`Missing AGENTS.md section: ${section.name}`);
    }
  }
}

if (errors.length > 0) {
  console.error("AI instruction check failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const lineCount = copilotText ? copilotText.split(/\r?\n/).length : 0;
const charCount = copilotText ? copilotText.length : 0;
console.log("AI instruction check passed.");
console.log(`- Copilot size: ${lineCount} lines, ${charCount} chars.`);
console.log("- Required AGENTS sections found.");
