#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: ./scripts/use-env-profile.sh <local|remote-test>"
  exit 1
fi

profile="$1"
profile_file=".env.profiles/${profile}.env"
example_file=".env.profiles/${profile}.env.example"

if [[ ! -f "$profile_file" ]]; then
  echo "Missing ${profile_file}."
  if [[ -f "$example_file" ]]; then
    echo "Create it from the example first:"
    echo "  cp ${example_file} ${profile_file}"
  fi
  exit 1
fi

cp "$profile_file" .env.local
echo "Activated env profile '${profile}' -> .env.local"
