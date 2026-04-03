/**
 * Cross-platform compile script.
 *
 * Builds standalone binaries for all supported platforms using Bun.build({ compile: true }).
 * Outputs to .npm-packages/<pkg>/bin/legna with a minimal package.json per platform.
 *
 * Usage:
 *   bun run scripts/compile-all.ts
 */

import { readFileSync, mkdirSync, writeFileSync, renameSync, copyFileSync, rmSync } from "fs";
import { resolve } from "path";

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

const EXTERNAL = [
  "@ant/claude-for-chrome-mcp",
  "@ant/computer-use-input",
  "@ant/computer-use-mcp",
  "@ant/computer-use-mcp/sentinelApps",
  "@ant/computer-use-mcp/types",
  "@ant/computer-use-swift",
  "@anthropic-ai/mcpb",
  "@anthropic-ai/sandbox-runtime",
  "@anthropic-ai/claude-agent-sdk",
  "audio-capture.node",
  "audio-capture-napi",
  "modifiers-napi",
  "color-diff-napi",
];

const TARGETS = [
  { bun: "bun-darwin-arm64", os: "darwin", cpu: "arm64", pkg: "@legna-lnc/legnacode-darwin-arm64" },
  { bun: "bun-darwin-x64", os: "darwin", cpu: "x64", pkg: "@legna-lnc/legnacode-darwin-x64" },
  { bun: "bun-linux-x64", os: "linux", cpu: "x64", pkg: "@legna-lnc/legnacode-linux-x64" },
  { bun: "bun-linux-arm64", os: "linux", cpu: "arm64", pkg: "@legna-lnc/legnacode-linux-arm64" },
  { bun: "bun-windows-x64", os: "win32", cpu: "x64", pkg: "@legna-lnc/legnacode-win32-x64" },
] as const;

const { defines, features } = parseBunfig();
defines["MACRO.BUILD_TIME"] = `'"${new Date().toISOString()}"'`;

const version = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")).version;
const outBase = resolve(ROOT, ".npm-packages");

for (const t of TARGETS) {
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
}

console.log("\nAll platforms compiled.");
