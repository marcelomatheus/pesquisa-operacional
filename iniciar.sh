#!/usr/bin/env sh
set -e

if [ ! -d "node_modules" ]; then
  echo "Instalando dependências do PivôNauta..."
  npm install
fi

echo "PivôNauta disponível em http://localhost:4173"
npm run dev
