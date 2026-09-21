#!/usr/bin/env bash
# PostToolUse: after an Edit/Write to a TS/TSX file, run Prettier on that file
# (fast, safe, always-on) and a project-wide `tsc --noEmit` as an advisory check
# (never blocks — just surfaces drift early, same checks `npm run check` runs later).
set -uo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

cd "$(dirname "$0")/../.." || exit 0

if [ -f "$file_path" ]; then
  npx --no-install prettier --write "$file_path" >/dev/null 2>&1 || true
fi

tsc_output=$(npx --no-install tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  echo "tsc --noEmit reported errors after editing $file_path (advisory only, not blocking):" >&2
  echo "$tsc_output" | head -40 >&2
fi

exit 0
