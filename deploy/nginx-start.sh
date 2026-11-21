#!/bin/sh
set -eu

mkdir -p \
    /tmp/nginx/client_body \
    /tmp/nginx/proxy \
    /tmp/nginx/fastcgi \
    /tmp/nginx/uwsgi \
    /tmp/nginx/scgi

if [ "$(id -u)" -eq 0 ]; then
    chown -R nginx:nginx /tmp/nginx
fi

exec "$@"
