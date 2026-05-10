#!/usr/bin/env node
"use strict";

var os = require("os");
var path = require("path");
var fs = require("fs");
var childProcess = require("child_process");

var PLATFORMS = {
  "darwin-arm64": "@legna-lnc/legnacode-darwin-arm64",
  "darwin-x64": "@legna-lnc/legnacode-darwin-x64",
  "linux-x64": "@legna-lnc/legnacode-linux-x64",
  "linux-arm64": "@legna-lnc/legnacode-linux-arm64",
  "win32-x64": "@legna-lnc/legnacode-win32-x64",
  "win32-ia32": "@legna-lnc/legnacode-win32-ia32",
};

var key = process.platform + "-" + os.arch();
var pkg = PLATFORMS[key];

if (!pkg) {
  console.error("legna: unsupported platform " + key);
  process.exit(1);
}

var binName = process.platform === "win32" ? "legna.exe" : "bin/legna";

function findBin() {
  var candidates = [];

  // Strategy 1: require.resolve
  try {
    var p = path.resolve(require.resolve(pkg + "/package.json"), "..", binName);
    candidates.push(p);
    if (fs.existsSync(p)) return p;
  } catch (e) {}

  // Strategy 2: sibling scope dir (global flat layout)
  // __dirname = .../node_modules/@legna-lnc/legnacode/npm/bin
  // go up to @legna-lnc scope dir, then into sibling package
  var scopeDir = path.resolve(__dirname, "..", "..", "..");
  var pkgName = pkg.split("/")[1];
  var flat = path.resolve(scopeDir, pkgName, binName);
  candidates.push(flat);
  if (fs.existsSync(flat)) return flat;

  // Strategy 3: nested node_modules (postinstall --no-save)
  var nested = path.resolve(__dirname, "..", "..", "node_modules", pkg, binName);
  candidates.push(nested);
  if (fs.existsSync(nested)) return nested;

  // Strategy 4: global prefix
  try {
    var prefix = childProcess.execSync("npm prefix -g", { encoding: "utf-8" }).trim();
    var globalPaths = [
      path.join(prefix, "node_modules", pkg, binName),
      path.join(prefix, "lib", "node_modules", pkg, binName),
    ];
    for (var gp of globalPaths) {
      candidates.push(gp);
      if (fs.existsSync(gp)) return gp;
    }
  } catch (e) {}

  // Debug: print all searched paths
  if (process.env.LEGNA_DEBUG) {
    console.error("legna: searched paths:");
    candidates.forEach(function(c) {
      console.error("  " + (fs.existsSync(c) ? "[OK]" : "[  ]") + " " + c);
    });
  }

  return null;
}

var bin = findBin();

if (!bin) {
  // Last resort: try to install from official registry
  var version;
  try {
    version = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf-8")).version;
  } catch (e) { version = "latest"; }

  console.error("legna: installing platform binary " + pkg + "@" + version + "...");
  var install = childProcess.spawnSync(
    "npm", ["install", "-g", pkg + "@" + version, "--registry", "https://registry.npmjs.org"],
    { stdio: "inherit", shell: true }
  );
  if (install.status === 0) bin = findBin();

  if (!bin) {
    console.error("legna: platform binary not found after install attempt.");
    console.error("Try: npm install -g " + pkg + " --registry https://registry.npmjs.org");
    console.error("Debug: set LEGNA_DEBUG=1 and run again to see searched paths.");
    process.exit(1);
  }
}

var result = childProcess.spawnSync(bin, process.argv.slice(2), {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  if (result.error.code === "EACCES") {
    fs.chmodSync(bin, 0o755);
    result = childProcess.spawnSync(bin, process.argv.slice(2), {
      stdio: "inherit",
      env: process.env,
    });
  } else {
    console.error("legna: spawn error: " + result.error.message);
    process.exit(1);
  }
}

process.exit(result.status === null ? 1 : result.status);
