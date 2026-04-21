#!/usr/bin/env bash
# native/build.sh — Build Rust NAPI addons for the current platform.
#
# Usage:
#   ./native/build.sh          # build all crates
#   ./native/build.sh sandbox  # build one crate

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/../src/native"

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  darwin) PLATFORM="darwin" ;;
  linux)  PLATFORM="linux"  ;;
  *)      PLATFORM="win32"  ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH_TAG="x64"   ;;
  aarch64|arm64) ARCH_TAG="arm64" ;;
  *)             ARCH_TAG="$ARCH" ;;
esac

echo "Building native modules for $PLATFORM-$ARCH_TAG"

# Ensure Rust toolchain
if ! command -v cargo &>/dev/null; then
  echo "Error: cargo not found. Install Rust: https://rustup.rs"
  exit 1
fi

CRATES=("sandbox" "file-search" "apply-patch")

if [ $# -gt 0 ]; then
  CRATES=("$1")
fi

mkdir -p "$TARGET_DIR"

for crate in "${CRATES[@]}"; do
  echo ""
  echo "=== Building $crate ==="
  cd "$SCRIPT_DIR/$crate"

  cargo build --release 2>&1

  # Find the .node or .dylib/.so output
  LIB_NAME="legnacode_${crate//-/_}"

  case "$PLATFORM" in
    darwin) SRC_LIB="$SCRIPT_DIR/target/release/lib${LIB_NAME}.dylib" ;;
    linux)  SRC_LIB="$SCRIPT_DIR/target/release/lib${LIB_NAME}.so"    ;;
    win32)  SRC_LIB="$SCRIPT_DIR/target/release/${LIB_NAME}.dll"      ;;
  esac

  DEST="$TARGET_DIR/${crate}.${PLATFORM}-${ARCH_TAG}.node"

  if [ -f "$SRC_LIB" ]; then
    cp "$SRC_LIB" "$DEST"
    echo "  → $DEST"
  else
    echo "  Warning: $SRC_LIB not found, skipping copy"
  fi
done

echo ""
echo "Done. Native modules in $TARGET_DIR/"
