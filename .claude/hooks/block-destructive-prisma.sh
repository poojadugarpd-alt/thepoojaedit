#!/usr/bin/env bash
# PreToolUse guard: blocks raw `prisma db push` / `prisma migrate reset` / `prisma db execute`
# run directly (not via the vetted `npm run db:*` scripts in package.json), per the project's
# own norm in docs/HANDOVER.md: "never `prisma db push`/`reset` against data that matters."
set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

if [ -z "$command" ]; then
  exit 0
fi

# Allow the reviewed npm wrappers (db:dev, db:migrate, db:migrate:deploy, db:reset, db:seed, db:studio).
if echo "$command" | grep -Eq '(^|&&|;|\|)\s*npm run db:'; then
  exit 0
fi

if echo "$command" | grep -Eq 'prisma (migrate reset|db push|db execute)'; then
  echo "Blocked: raw '$command' bypasses the reviewed npm run db:* wrappers." >&2
  echo "Use the package.json script instead (npm run db:reset / db:migrate / etc.), or confirm with the user first if you genuinely need the raw prisma CLI." >&2
  exit 2
fi

exit 0
