/**
 * Cross-platform compile script.
 *
 * Builds standalone binaries for all supported platforms using Bun.build({ compile: true }).
 * Outputs to .npm-packages/<pkg>/bin/legna with a minimal package.json per platform.
 *
 * Usage:
 *   bun run scripts/compile-all.ts
 */

import { readFileSync, mkdirSync, writeFileSync, renameSync, copyFileSync, rmSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";

const ROOT = resolve(import.meta.dir, "..");

// Reuse parseBunfig from compile.ts
function parseBunfig(): { defines: Record<string, string>; features: string[] } {
  const content = readFileSync(resolve(ROOT, "bunfig.toml"), "utf-8");
  const defines: Record<string, string> = {};
  const features: string[] = [];
  let section: "define" | "features" | null = null;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "[bundle.define]") { section = "define"; continue; }
    if (trimmed === "[bundle.features]") { section = "features"; continue; }
    if (trimmed.startsWith("[")) { section = null; continue; }
    if (!line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    const k = key!.trim().replace(/"/g, "");
    const v = rest.join("=").trim();
    if (section === "define") defines[k] = v;
    else if (section === "features" && v === "true") features.push(k);
  }
  return { defines, features };
}

const EXTERNAL: string[] = [];

const TARGETS = [
  { bun: "bun-darwin-arm64", os: "darwin", cpu: "arm64", pkg: "@legna-lnc/legnacode-darwin-arm64" },
  { bun: "bun-darwin-x64", os: "darwin", cpu: "x64", pkg: "@legna-lnc/legnacode-darwin-x64" },
  { bun: "bun-darwin-x64-baseline", os: "darwin", cpu: "x64", pkg: "@legna-lnc/legnacode-darwin-x64-baseline" },
  { bun: "bun-linux-x64", os: "linux", cpu: "x64", pkg: "@legna-lnc/legnacode-linux-x64" },
  { bun: "bun-linux-x64-baseline", os: "linux", cpu: "x64", pkg: "@legna-lnc/legnacode-linux-x64-baseline" },
  { bun: "bun-linux-arm64", os: "linux", cpu: "arm64", pkg: "@legna-lnc/legnacode-linux-arm64" },
  { bun: "bun-windows-x64", os: "win32", cpu: "x64", pkg: "@legna-lnc/legnacode-win32-x64" },
] as const;

const skipPlatforms = process.argv.slice(2)
  .filter(a => a.startsWith('--skip='))
  .flatMap(a => a.slice(7).split(','));

const { defines, features } = parseBunfig();
defines["MACRO.BUILD_TIME"] = `'"${new Date().toISOString()}"'`;

const version = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")).version;
const outBase = resolve(ROOT, ".npm-packages");

const targets = TARGETS.filter(t => !skipPlatforms.includes(`${t.os}-${t.cpu}`));

for (const t of targets) {
  const isWin = t.os === "win32";
  const binName = isWin ? "legna.exe" : "cli";
  const tmpDir = resolve(ROOT, ".compile-tmp");

  console.log(`Compiling ${t.pkg}...`);

  const result = await Bun.build({
    entrypoints: [resolve(ROOT, "src/entrypoints/cli.tsx")],
    outdir: tmpDir,
    target: t.bun as any,
    compile: true,
    define: defines,
    features,
    external: EXTERNAL,
  });

  if (!result.success) {
    console.error(`Failed: ${t.pkg}`);
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }

  // Move binary into package directory
  const pkgDir = resolve(outBase, t.pkg.replace("@legna-lnc/", ""));
  const binDir = isWin ? pkgDir : resolve(pkgDir, "bin");
  mkdirSync(binDir, { recursive: true });

  const src = resolve(tmpDir, isWin ? "cli.exe" : "cli");
  const dest = resolve(binDir, isWin ? "legna.exe" : "legna");
  try { renameSync(src, dest); } catch {
    copyFileSync(src, dest);
  }
  rmSync(tmpDir, { recursive: true, force: true });

  // Write platform package.json
  writeFileSync(
    resolve(pkgDir, "package.json"),
    JSON.stringify({
      name: t.pkg,
      version,
      description: `LegnaCode binary for ${t.os}-${t.cpu}`,
      os: [t.os],
      cpu: [t.cpu],
      preferUnplugged: true,
    }, null, 2) + "\n"
  );

  console.log(`  → ${dest}`);

  // Copy native NAPI addons (.node files) for this platform
  // Check both src/native/ (committed) and native/*/  (napi build output)
  const nativeDir = resolve(ROOT, "src/native");
  const nativeBuildDirs = ["sandbox", "file-search", "apply-patch"].map(n => resolve(ROOT, "native", n));
  const platformSuffix = `${t.os === 'darwin' ? 'darwin' : t.os === 'linux' ? 'linux' : 'win32'}-${t.cpu}`;

  // Source 1: src/native/ (pre-committed addons)
  if (existsSync(nativeDir)) {
    for (const f of readdirSync(nativeDir)) {
      if (f.endsWith(`.${platformSuffix}.node`)) {
        const addonSrc = join(nativeDir, f);
        const addonDest = join(binDir, f);
        copyFileSync(addonSrc, addonDest);
        console.log(`  → ${addonDest} (native addon)`);
      }
    }
  }

  // Source 2: native/*/ (napi build output — takes precedence over src/native/)
  for (const buildDir of nativeBuildDirs) {
    if (!existsSync(buildDir)) continue;
    for (const f of readdirSync(buildDir)) {
      if (f.endsWith(`.${platformSuffix}.node`)) {
        const addonSrc = join(buildDir, f);
        const addonDest = join(binDir, f);
        copyFileSync(addonSrc, addonDest);
        console.log(`  → ${addonDest} (native addon, fresh build)`);
      }
    }
  }
}

console.log("\nAll platforms compiled.");
