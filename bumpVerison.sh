#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
	echo "Usage: $0 <version>" >&2
	exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_version="$1"

cd "$script_dir"

# Update package.json and package-lock.json without creating a commit or tag.
npm version "$target_version" \
	--no-git-tag-version \
	--ignore-scripts \
	--allow-same-version \
	>/dev/null

# Keep the Obsidian manifest and compatibility map in sync.
node version-bump.mjs "$target_version"

version_files=(package.json package-lock.json manifest.json versions.json)

git add -- "${version_files[@]}"
git commit -S -m "$target_version" -- "${version_files[@]}"

echo "Bumped version to $target_version and created a signed Git commit"
