#!/bin/sh
# PostToolUse hook (Edit|Write|MultiEdit): when an agent changes content, the
# CMS config or code that renders content, run `bun test`. A failure is fed
# back to the agent (exit 2) so it fixes the gap before moving on – see the
# rules in AGENTS.md. Other files are ignored, so the hook costs nothing.
file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')

case "$file" in
  */src/data/*|*/src/i18n/*|*/src/lib/*|*/src/components/*|*/src/pages/*|*/public/admin/config.yml|*/tests/*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
output=$(bun test 2>&1) && exit 0

{
  echo "bun test failed after editing ${file#"$PWD"/}. Fix it before continuing (AGENTS.md: content needs a CMS field + tests):"
  echo "$output" | grep -v "^\s*$" | tail -40
} >&2
exit 2
