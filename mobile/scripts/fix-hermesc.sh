#!/bin/bash
# ARM64 containers can't run the x86_64 hermesc; wrap it with qemu-user-static.
# Non-fatal script - failures are logged but don't stop the build.

set +e

BIN_DIR="$(dirname "$0")/../node_modules/react-native/sdks/hermesc/linux64-bin"

# Only continue if we're on ARM64
if [ "$(uname -m)" != "aarch64" ]; then
  exit 0
fi

# Only continue if the binary exists
if [ ! -f "$BIN_DIR/hermesc" ]; then
  exit 0
fi

# Check if it's a shell script already
if head -c 32 "$BIN_DIR/hermesc" 2>/dev/null | grep -q "#!/"; then
  exit 0
fi

# Try to create wrapper
cd "$BIN_DIR" 2>/dev/null || exit 0
mv hermesc hermesc-x86_64 2>/dev/null || exit 0

{
  cat > hermesc << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec /usr/bin/qemu-x86_64-static "$DIR/hermesc-x86_64" "$@"
EOF
} 2>/dev/null || {
  # Restore on failure
  mv hermesc-x86_64 hermesc 2>/dev/null || true
  exit 0
}

chmod +x hermesc 2>/dev/null || true
exit 0
