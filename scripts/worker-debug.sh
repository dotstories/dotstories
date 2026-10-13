#!/usr/bin/env bash
# Temporary: start the built worker, request "/", print response + worker logs.
pnpm preview:worker --port 8788 > preview.log 2>&1 &
pid=$!
for i in $(seq 1 30); do curl -s -o /dev/null localhost:8788/logo.png && break; sleep 2; done
echo "=== GET / ==="
curl -sS -m 30 -i localhost:8788/ | head -c 2500
echo
echo "=== GET / (2nd) ==="
curl -sS -m 30 -o /dev/null -w "%{http_code}\n" localhost:8788/
sleep 2
kill $pid 2>/dev/null
echo "=== worker log ==="
grep -v "^\s*$" preview.log | tail -n 80
exit 1
