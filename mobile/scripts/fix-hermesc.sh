#!/bin/bash
# ARM64 containers can't run the x86_64 hermesc; wrap it with qemu-user-static.
# This script is best-effort and failures are non-fatal.
set -e

BIN_DIR="$(dirname "$0")/../node_modules/react-native/sdks/hermesc/linux64-bin"

# Only continue if we're on ARM64
[ "$(uname -m)" = "aarch64" ] || exit 0

# Only continue if the binary exists
[ -f "$BIN_DIR/hermesc" ] || exit 0

# Check if it's a shell script already (has bash shebang)
if head -c 32 "$BIN_DIR/hermesc" 2>/dev/null | grep -q "#!/"; then
  exit 0
fi

# Try to wrap it, but don't fail if we can't
{
  mv "$BIN_DIR/hermesc" "$BIN_DIR/hermesc-x86_64" || exit 0
  exec_path="$(cd "$BIN_DIR" && pwd)" || exec_path="$BIN_DIR"
  printf '#!/bin/bash\nexec /usr/bin/qemu-x86_64-static "%s/hermesc-x86_64" "$@"\n' "$exec_path" > "$BIN_DIR/hermesc"
  chmod +x "$BIN_DIR/hermesc"
} || {
  # If wrapping failed, try to restore original
  [ -f "$BIN_DIR/hermesc-x86_64" ] && mv "$BIN_DIR/hermesc-x86_64" "$BIN_DIR/hermesc" || true
  exit 0
}

exit 0
