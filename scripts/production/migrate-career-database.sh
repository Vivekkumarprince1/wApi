#!/usr/bin/env bash
set -euo pipefail

SOURCE_URI="${SOURCE_MONGODB_URI:-}"
TARGET_URI="${CAREER_MONGODB_URI:-}"
SCHEMA_FILE="${SCHEMA_FILE:-apps/career-portal/prisma/schema.prisma}"
TARGET_DATABASE="${CAREER_DATABASE_NAME:-career}"
APPLY=false

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
elif [[ -n "${1:-}" ]]; then
  echo "Usage: SOURCE_MONGODB_URI=... CAREER_MONGODB_URI=... $0 [--apply]" >&2
  exit 64
fi

if [[ -z "$SOURCE_URI" || -z "$TARGET_URI" ]]; then
  echo "SOURCE_MONGODB_URI and CAREER_MONGODB_URI are required." >&2
  exit 64
fi

for command in mongodump mongorestore node grep sed sort; do
  command -v "$command" >/dev/null || {
    echo "$command is required." >&2
    exit 69
  }
done

if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "Career Prisma schema not found: $SCHEMA_FILE" >&2
  exit 66
fi

source_database="$(node -e 'console.log(new URL(process.argv[1]).pathname.slice(1))' "$SOURCE_URI")"
target_database="$(node -e 'console.log(new URL(process.argv[1]).pathname.slice(1))' "$TARGET_URI")"

if [[ -z "$source_database" || -z "$target_database" ]]; then
  echo "Both MongoDB URIs must contain explicit database names." >&2
  exit 65
fi

if [[ "$source_database" == "$target_database" ]]; then
  echo "Source and target databases must differ." >&2
  exit 65
fi

if [[ "$target_database" != "$TARGET_DATABASE" ]]; then
  echo "Target URI database must be $TARGET_DATABASE, got $target_database." >&2
  exit 65
fi

collections="$(
  grep -oE '@@map\("[^"]+"\)' "$SCHEMA_FILE" \
    | sed -E 's/@@map\("([^"]+)"\)/\1/' \
    | sort -u
)"

collection_count="$(printf '%s\n' "$collections" | grep -c .)"
echo "Source database: $source_database"
echo "Target database: $target_database"
echo "Career-owned collections from Prisma schema: $collection_count"

if [[ "$APPLY" != true ]]; then
  echo "Dry run only. Re-run with --apply to copy career-owned collections."
  exit 0
fi

archive="$(mktemp -d "${TMPDIR:-/tmp}/connectsphere-career-migration.XXXXXX")"
trap 'rm -rf "$archive"' EXIT

while IFS= read -r collection; do
  [[ -z "$collection" ]] && continue
  mongodump \
    --uri "$SOURCE_URI" \
    --collection "$collection" \
    --out "$archive" \
    --quiet
done <<< "$collections"

mongorestore \
  --uri "$TARGET_URI" \
  --drop \
  --nsFrom "$source_database.*" \
  --nsTo "$target_database.*" \
  "$archive/$source_database" \
  --quiet

echo "Career database migration completed. Source database was not modified."
