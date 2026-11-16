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
  printf 'Docker Compose v2 é necessário para o deploy manual.\n' >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" up -d --build --wait
"${COMPOSE[@]}" exec -T web wget -q -O /dev/null http://127.0.0.1:18473/api/v1/health/ready
"${COMPOSE[@]}" ps

printf 'PivôNauta ativo na rede Traefik. Configure o hostname no Cloudflare Tunnel.\n'
printf 'Para validar a rota pública: PIVONAUTA_URL=https://SEU_DOMINIO python3 scripts/smoke_production.py\n'
