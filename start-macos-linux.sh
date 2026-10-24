#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
NPM_CONFIG_CACHE="${TMPDIR:-/tmp}/lh-plan-lab-npm" npm ci --no-audit --no-fund
npm run dev
