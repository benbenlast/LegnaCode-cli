/**
 * Publish script for platform binary distribution.
 *
 * 1. Runs compile-all to build all platform binaries
 * 2. Publishes platform packages first, then the main package
 *
 * Usage:
 *   bun run scripts/publish.ts [--dry-run]
 */

import { resolve } from "path";
import { readdirSync, readFileSync } from "fs";

const ROOT = resolve(import.meta.dir, "..");
const dryRun = process.argv.includes("--dry-run");
const npmArgs = ["publish", "--access", "public"];
if (dryRun) npmArgs.push("--dry-run");

// Step 1: Compile all platforms
console.log("=== Compiling all platforms ===\n");
const compile = Bun.spawnSync(["bun", "run", "scripts/compile-all.ts"], {
  cwd: ROOT,
  stdio: ["inherit", "inherit", "inherit"],
});
if (compile.exitCode !== 0) {
  console.error("Compile failed");
  process.exit(1);
}

// Step 2: Publish platform packages
const pkgBase = resolve(ROOT, ".npm-packages");
const platformDirs = readdirSync(pkgBase, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

console.log("\n=== Publishing platform packages ===\n");
for (const dir of platformDirs) {
  const pkgDir = resolve(pkgBase, dir);
  const name = JSON.parse(readFileSync(resolve(pkgDir, "package.json"), "utf-8")).name;
  console.log(`Publishing ${name}...`);
  const r = Bun.spawnSync(["npm", ...npmArgs], {
    cwd: pkgDir,
    stdio: ["inherit", "inherit", "inherit"],
  });
  if (r.exitCode !== 0) {
    console.error(`Failed to publish ${name}`);
    process.exit(1);
  }
}

// Step 3: Publish main package
console.log("\n=== Publishing main package ===\n");
const main = Bun.spawnSync(["npm", ...npmArgs], {
  cwd: ROOT,
  stdio: ["inherit", "inherit", "inherit"],
});
if (main.exitCode !== 0) {
  console.error("Failed to publish main package");
  process.exit(1);
}

console.log("\nDone" + (dryRun ? " (dry run)" : "") + ".");
