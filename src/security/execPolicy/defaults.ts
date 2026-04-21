/**
 * Built-in default execution policy rules.
 * These apply even without a user config file.
 */

import type { PolicyRule } from './types.js'

export const DEFAULT_RULES: PolicyRule[] = [
  // ── Forbidden: destructive system commands ──────────────────────────
  { kind: 'prefix', pattern: 'rm -rf /', decision: 'forbidden', description: 'Recursive delete root' },
  { kind: 'prefix', pattern: 'rm -rf ~', decision: 'forbidden', description: 'Recursive delete home' },
  { kind: 'prefix', pattern: 'rm -rf *', decision: 'forbidden', description: 'Recursive delete wildcard' },
  { kind: 'prefix', pattern: 'mkfs', decision: 'forbidden', description: 'Format filesystem' },
  { kind: 'regex', pattern: 'dd\\s+if=.*of=/dev/', decision: 'forbidden', description: 'Raw disk write' },
  { kind: 'prefix', pattern: 'format C:', decision: 'forbidden', description: 'Format drive (Windows)' },
  { kind: 'prefix', pattern: 'shutdown', decision: 'forbidden', description: 'System shutdown' },
  { kind: 'prefix', pattern: 'reboot', decision: 'forbidden', description: 'System reboot' },
  { kind: 'prefix', pattern: 'init 0', decision: 'forbidden', description: 'System halt' },
  { kind: 'prefix', pattern: 'init 6', decision: 'forbidden', description: 'System reboot' },
  { kind: 'prefix', pattern: ':(){', decision: 'forbidden', description: 'Fork bomb' },

  // ── Forbidden: pipe-to-shell (supply chain attack vector) ──────────
  { kind: 'regex', pattern: 'curl\\s.*\\|\\s*(sh|bash|zsh)', decision: 'forbidden', description: 'Pipe curl to shell' },
  { kind: 'regex', pattern: 'wget\\s.*\\|\\s*(sh|bash|zsh)', decision: 'forbidden', description: 'Pipe wget to shell' },
  { kind: 'regex', pattern: 'curl\\s.*\\|\\s*(python|node|perl|ruby)', decision: 'forbidden', description: 'Pipe curl to interpreter' },

  // ── Prompt: package installation ───────────────────────────────────
  { kind: 'host_executable', pattern: 'npm', decision: 'prompt', description: 'npm command' },
  { kind: 'host_executable', pattern: 'yarn', decision: 'prompt', description: 'yarn command' },
  { kind: 'host_executable', pattern: 'pnpm', decision: 'prompt', description: 'pnpm command' },
  { kind: 'prefix', pattern: 'pip install', decision: 'prompt', description: 'pip install' },
  { kind: 'prefix', pattern: 'pip3 install', decision: 'prompt', description: 'pip3 install' },
  { kind: 'prefix', pattern: 'cargo install', decision: 'prompt', description: 'cargo install' },
  { kind: 'prefix', pattern: 'brew install', decision: 'prompt', description: 'brew install' },
  { kind: 'prefix', pattern: 'apt install', decision: 'prompt', description: 'apt install' },
  { kind: 'prefix', pattern: 'apt-get install', decision: 'prompt', description: 'apt-get install' },
  { kind: 'prefix', pattern: 'yum install', decision: 'prompt', description: 'yum install' },
  { kind: 'prefix', pattern: 'dnf install', decision: 'prompt', description: 'dnf install' },
  { kind: 'prefix', pattern: 'pacman -S', decision: 'prompt', description: 'pacman install' },

  // ── Prompt: permission changes ─────────────────────────────────────
  { kind: 'prefix', pattern: 'chmod 777', decision: 'prompt', description: 'World-writable permissions' },
  { kind: 'prefix', pattern: 'chmod -R', decision: 'prompt', description: 'Recursive permission change' },
  { kind: 'prefix', pattern: 'chown', decision: 'prompt', description: 'Ownership change' },
  { kind: 'prefix', pattern: 'sudo', decision: 'prompt', description: 'Elevated privileges' },

  // ── Allow: read-only git operations ────────────────────────────────
  { kind: 'prefix', pattern: 'git status', decision: 'allow', description: 'Git status' },
  { kind: 'prefix', pattern: 'git diff', decision: 'allow', description: 'Git diff' },
  { kind: 'prefix', pattern: 'git log', decision: 'allow', description: 'Git log' },
  { kind: 'prefix', pattern: 'git branch', decision: 'allow', description: 'Git branch list' },
  { kind: 'prefix', pattern: 'git show', decision: 'allow', description: 'Git show' },
  { kind: 'prefix', pattern: 'git remote -v', decision: 'allow', description: 'Git remote list' },
  { kind: 'prefix', pattern: 'git stash list', decision: 'allow', description: 'Git stash list' },

  // ── Allow: read-only file operations ───────────────────────────────
  { kind: 'host_executable', pattern: 'ls', decision: 'allow', description: 'List files' },
  { kind: 'host_executable', pattern: 'cat', decision: 'allow', description: 'Print file' },
  { kind: 'host_executable', pattern: 'head', decision: 'allow', description: 'Print file head' },
  { kind: 'host_executable', pattern: 'tail', decision: 'allow', description: 'Print file tail' },
  { kind: 'host_executable', pattern: 'wc', decision: 'allow', description: 'Word count' },
  { kind: 'host_executable', pattern: 'find', decision: 'allow', description: 'Find files' },
  { kind: 'host_executable', pattern: 'grep', decision: 'allow', description: 'Search text' },
  { kind: 'host_executable', pattern: 'rg', decision: 'allow', description: 'Ripgrep search' },
  { kind: 'host_executable', pattern: 'fd', decision: 'allow', description: 'fd find' },
  { kind: 'host_executable', pattern: 'tree', decision: 'allow', description: 'Directory tree' },
  { kind: 'host_executable', pattern: 'file', decision: 'allow', description: 'File type' },
  { kind: 'host_executable', pattern: 'stat', decision: 'allow', description: 'File stats' },
  { kind: 'host_executable', pattern: 'du', decision: 'allow', description: 'Disk usage' },
  { kind: 'host_executable', pattern: 'df', decision: 'allow', description: 'Disk free' },
  { kind: 'host_executable', pattern: 'which', decision: 'allow', description: 'Locate command' },
  { kind: 'host_executable', pattern: 'whereis', decision: 'allow', description: 'Locate binary' },
  { kind: 'host_executable', pattern: 'type', decision: 'allow', description: 'Command type' },
  { kind: 'host_executable', pattern: 'echo', decision: 'allow', description: 'Echo text' },
  { kind: 'host_executable', pattern: 'pwd', decision: 'allow', description: 'Print working dir' },
  { kind: 'host_executable', pattern: 'env', decision: 'allow', description: 'Print environment' },
  { kind: 'host_executable', pattern: 'printenv', decision: 'allow', description: 'Print env var' },
  { kind: 'host_executable', pattern: 'uname', decision: 'allow', description: 'System info' },
  { kind: 'host_executable', pattern: 'whoami', decision: 'allow', description: 'Current user' },
  { kind: 'host_executable', pattern: 'date', decision: 'allow', description: 'Current date' },
  { kind: 'host_executable', pattern: 'id', decision: 'allow', description: 'User identity' },

  // ── Allow: version queries ─────────────────────────────────────────
  { kind: 'regex', pattern: '^(node|python3?|rustc|go|java|ruby|php|dotnet|bun|deno)\\s+--version$', decision: 'allow', description: 'Version query' },
  { kind: 'regex', pattern: '^(node|python3?|rustc|go|java|ruby|php|dotnet|bun|deno)\\s+-v$', decision: 'allow', description: 'Version query short' },
  { kind: 'regex', pattern: '^(npm|yarn|pnpm|pip3?|cargo|brew|apt|gem|composer)\\s+--version$', decision: 'allow', description: 'Package manager version' },
]
