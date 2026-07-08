#!/bin/bash
# ARM64 containers can't run the x86_64 hermesc; wrap it with qemu-user-static.
BIN_DIR="$(dirname "$0")/../node_modules/react-native/sdks/hermesc/linux64-bin"
[ "$(uname -m)" = "aarch64" ] || exit 0
[ -f "$BIN_DIR/hermesc" ] || exit 0
if ! head -c 20 "$BIN_DIR/hermesc" | grep -q bash; then
  mv "$BIN_DIR/hermesc" "$BIN_DIR/hermesc-x86_64"
  printf '#!/bin/bash\nexec /usr/bin/qemu-x86_64-static "%s/hermesc-x86_64" "$@"\n' "$(cd "$BIN_DIR" && pwd)" > "$BIN_DIR/hermesc"
  chmod +x "$BIN_DIR/hermesc"
fi
