#!/usr/bin/env bash
# Runs a CI command. On failure, shows its last lines as an error on the PR page.
log=$(mktemp)
"$@" 2>&1 | tee "$log"
code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  msg=$(tail -n "${TAIL:-40}" "$log" | tr -d '\r' | sed 's/\x1b\[[0-9;]*m//g; s/%/%25/g' | sed ':a;N;$!ba;s/\n/%0A/g')
  echo "::error title=Failed: $*::$msg"
fi
exit "$code"
