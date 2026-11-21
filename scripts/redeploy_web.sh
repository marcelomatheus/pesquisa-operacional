#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$PROJECT_ROOT/.env.production}"
COMPOSE_FILE="$PROJECT_ROOT/compose.production.yaml"

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Arquivo de ambiente não encontrado: %s\n' "$ENV_FILE" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  printf 'Docker Compose v2 é necessário.\n' >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  printf 'Python 3 é necessário para validar o domínio publicado.\n' >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${COMPOSE[@]}" config --quiet

API_ID="$("${COMPOSE[@]}" ps -q api)"
if [[ -z "$API_ID" ]] || [[ "$(docker inspect -f '{{.State.Health.Status}}' "$API_ID")" != "healthy" ]]; then
  printf 'A API existente deve estar healthy antes de atualizar somente o web.\n' >&2
  exit 1
fi

"${COMPOSE[@]}" up -d --build --no-deps --force-recreate --wait web

if [[ "$("${COMPOSE[@]}" ps -q api)" != "$API_ID" ]]; then
  printf 'O serviço api foi alterado inesperadamente.\n' >&2
  exit 1
fi

WEB_ID="$("${COMPOSE[@]}" ps -q web)"
if [[ -z "$WEB_ID" ]] || [[ "$(docker inspect -f '{{.State.Health.Status}}' "$WEB_ID")" != "healthy" ]]; then
  printf 'O serviço web não está healthy.\n' >&2
  exit 1
fi

if [[ "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$WEB_ID")" != "true" ]]; then
  printf 'O filesystem somente leitura não está ativo.\n' >&2
  exit 1
fi

"${COMPOSE[@]}" exec -T web sh -c '
  test "$(id -u)" = 101
  for directory in client_body proxy fastcgi uwsgi scgi; do
    test -w "/tmp/nginx/$directory" || exit 1
  done
  wget -q -O /dev/null http://127.0.0.1:18473/api/v1/health/ready
  wget -q -O /dev/null http://127.0.0.1:18473/
'

sleep 5

if [[ "$(docker inspect -f '{{.State.Health.Status}}' "$WEB_ID")" != "healthy" ]] ||
   [[ "$(docker inspect -f '{{.RestartCount}}' "$WEB_ID")" != "0" ]]; then
  printf 'O serviço web reiniciou ou perdeu a condição healthy.\n' >&2
  exit 1
fi

if [[ -z "${PIVONAUTA_URL:-}" ]]; then
  DOMAIN="$("${COMPOSE[@]}" config --format json | python3 -c '
import json
import re
import sys

data = json.load(sys.stdin)
rule = data["services"]["web"]["labels"]["traefik.http.routers.pivonauta.rule"]
match = re.fullmatch(r"Host\(`([^\`]+)\`\)", rule)
if not match:
    raise SystemExit("Regra Host do Traefik inválida")
print(match.group(1))
')"
  PIVONAUTA_URL="https://$DOMAIN"
fi

export PIVONAUTA_URL
python3 "$PROJECT_ROOT/scripts/smoke_production.py"
"${COMPOSE[@]}" ps

printf 'Web atualizado e validado sem reiniciar a API.\n'
