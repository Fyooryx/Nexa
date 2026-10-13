#!/bin/sh
set -eu

if [ "$(id -u)" -eq 0 ]; then
  mkdir -p "${AUTH_DIR:-/app/runtime/auth_info}" "${DATA_DIR:-/app/runtime/data}"
  chown -R node:node /app/runtime
  exec gosu node npm start
fi

exec npm start
