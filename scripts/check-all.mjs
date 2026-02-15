#!/usr/bin/env node
/**
 * Runs lint, typecheck, tests and AI-instruction checks sequentially.
 * All steps run even if earlier ones fail, so every error is surfaced.
 */
import { execSync } from "node:child_process";

const steps = [
  { name: "lint:all", cmd: "npx eslint ." },
  { name: "typecheck", cmd: "npx tsc --project tsconfig.typecheck.json" },
  { name: "test:unit", cmd: "npm run test:unit" },
  {
    name: "check:ai-instructions",
    cmd: "node scripts/check-ai-instructions.mjs",
  },
];

let failed = 0;

for (const step of steps) {
  console.log(`\n========== ${step.name} ==========\n`);
  try {
    execSync(step.cmd, { stdio: "inherit" });
    console.log(`\n✓ ${step.name} passed`);
  } catch {
    failed++;
    console.error(`\n✗ ${step.name} failed`);
  }
}

console.log(`\n========== Summary ==========`);
console.log(`${steps.length - failed}/${steps.length} checks passed.`);
if (failed > 0) {
  process.exit(1);
}
