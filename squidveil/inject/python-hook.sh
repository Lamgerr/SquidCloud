#!/usr/bin/env bash
# python-hook.sh — SquidVeil Python auto-injection
# Installs a .pth file (or symlink) so 'import squidveil' works project-wide.
set -euo pipefail

SQUIDVEIL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHIM_DIR="$SQUIDVEIL_ROOT/shims/python"

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

echo "==> SquidVeil Python hook"
echo "    Project : $PROJECT_DIR"
echo "    Shim    : $SHIM_DIR"

# Check shim exists
if [[ ! -f "$SHIM_DIR/squidveil.py" ]]; then
  echo "ERROR: Shim not found at $SHIM_DIR/squidveil.py" >&2
  exit 1
fi

# --- Detect Python / venv ---
PYTHON=""
SITE_PACKAGES=""

# 1) Check for an active virtualenv already on PATH
if command -v python3 &>/dev/null; then
  PYTHON="python3"
elif command -v python &>/dev/null; then
  PYTHON="python"
fi

# 2) Look for a local virtualenv in common locations
for venv_candidate in \
  "$PROJECT_DIR/.venv" \
  "$PROJECT_DIR/venv" \
  "$PROJECT_DIR/.env" \
  "$PROJECT_DIR/env"; do
  if [[ -f "$venv_candidate/bin/activate" || -f "$venv_candidate/pyvenv.cfg" ]]; then
    echo "    Found virtualenv : $venv_candidate"
    SITE_PACKAGES=$(find "$venv_candidate/lib" -maxdepth 3 -type d -name site-packages 2>/dev/null | head -1)
    break
  fi
done

# 3) If no venv found, use the system Python site-packages
if [[ -z "$SITE_PACKAGES" ]]; then
  if [[ -z "$PYTHON" ]]; then
    echo "ERROR: No Python interpreter found" >&2
    exit 1
  fi
  echo "    No local virtualenv detected; using system Python"
  SITE_PACKAGES=$("$PYTHON" -c "import site; print(site.getsitepackages()[0])" 2>/dev/null) || {
    echo "ERROR: Could not determine system site-packages" >&2
    exit 1
  }
fi

if [[ ! -d "$SITE_PACKAGES" ]]; then
  echo "ERROR: site-packages directory not found: $SITE_PACKAGES" >&2
  exit 1
fi

echo "    Site-packages : $SITE_PACKAGES"

# --- Install ---
PTH_FILE="$SITE_PACKAGES/squidveil.pth"
SYMLINK_TARGET="$SITE_PACKAGES/squidveil"

# Strategy: try .pth file first (cleaner); fall back to symlink.
if mkdir -p "$SITE_PACKAGES" 2>/dev/null && touch "$PTH_FILE" 2>/dev/null; then
  echo "$SHIM_DIR" > "$PTH_FILE"
  echo "    Installed .pth : $PTH_FILE"
  echo "    -> $SHIM_DIR"
else
  echo "    (cannot write .pth; trying symlink instead)"
  if [[ -L "$SYMLINK_TARGET" || -d "$SYMLINK_TARGET" ]]; then
    rm -rf "$SYMLINK_TARGET"
  fi
  ln -sf "$SHIM_DIR" "$SYMLINK_TARGET"
  echo "    Installed symlink : $SYMLINK_TARGET"
  echo "    -> $SHIM_DIR"
fi

echo "==> Done. Run 'import squidveil' from within project."
