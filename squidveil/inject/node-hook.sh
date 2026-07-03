#!/usr/bin/env bash
# node-hook.sh — SquidVeil Node.js auto-injection
# Creates node_modules/squidveil → ../wasm so 'import "@squidcloud/squidveil-wasm"' resolves.
set -euo pipefail

SQUIDVEIL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM_DIR="$SQUIDVEIL_ROOT/wasm"

usage() {
  echo "Usage: $0 [project-dir]"
  echo "  project-dir    Project root (default: current directory)"
  exit 1
}

PROJECT_DIR="${1:-$(pwd)}"
PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd)" || {
  echo "ERROR: Cannot access directory '$1'" >&2
  exit 1
}

echo "==> SquidVeil Node.js hook"
echo "    Project : $PROJECT_DIR"
echo "    WASM    : $WASM_DIR"

# Check WASM package exists
if [[ ! -f "$WASM_DIR/package.json" ]]; then
  echo "ERROR: WASM package not found at $WASM_DIR/package.json" >&2
  exit 1
fi

# --- Detect package manager ---
PKG_MANAGER="npm"
if [[ -f "$PROJECT_DIR/pnpm-lock.yaml" ]]; then
  PKG_MANAGER="pnpm"
elif [[ -f "$PROJECT_DIR/yarn.lock" ]]; then
  PKG_MANAGER="yarn"
elif [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
  PKG_MANAGER="npm"
fi
echo "    Package manager : $PKG_MANAGER"

# --- Determine node_modules path ---
NODE_MODULES=""
case "$PKG_MANAGER" in
  pnpm)
    # pnpm may use a virtual store; prefer project-level node_modules
    if [[ -d "$PROJECT_DIR/node_modules" ]]; then
      NODE_MODULES="$PROJECT_DIR/node_modules"
    else
      NODE_MODULES="$PROJECT_DIR/node_modules"
    fi
    ;;
  yarn)
    NODE_MODULES="$PROJECT_DIR/node_modules"
    ;;
  *)
    NODE_MODULES="$PROJECT_DIR/node_modules"
    ;;
esac

# --- Install symlink ---
LINK_TARGET="$NODE_MODULES/squidveil"

mkdir -p "$NODE_MODULES"

# Compute relative path from node_modules/squidveil → wasm
REL_WASM=$(python3 -c "
import os.path
try:
  print(os.path.relpath('$WASM_DIR', '$NODE_MODULES'))
except:
  print('$WASM_DIR')
" 2>/dev/null) || REL_WASM="$WASM_DIR"

if [[ -L "$LINK_TARGET" || -d "$LINK_TARGET" ]]; then
  echo "    Removing existing : $LINK_TARGET"
  rm -rf "$LINK_TARGET"
fi

ln -sf "$REL_WASM" "$LINK_TARGET"
echo "    Symlink created : $LINK_TARGET"
echo "    -> $WASM_DIR"

# --- Also install a package-level alias so bare imports resolve ---
PACKAGE_ALIAS="$NODE_MODULES/@squidcloud"
mkdir -p "$PACKAGE_ALIAS"

ALIAS_TARGET="$PACKAGE_ALIAS/squidveil-wasm"
if [[ -L "$ALIAS_TARGET" || -d "$ALIAS_TARGET" ]]; then
  rm -rf "$ALIAS_TARGET"
fi
ln -sf "$REL_WASM" "$ALIAS_TARGET"
echo "    Alias created    : $ALIAS_TARGET"
echo "    -> $WASM_DIR"

echo "==> Done. Import with: import { ... } from '@squidcloud/squidveil-wasm';"
