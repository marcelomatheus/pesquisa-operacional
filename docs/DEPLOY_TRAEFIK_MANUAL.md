# Deploy manual do PivôNauta na VPS com Traefik e Cloudflare Tunnel

## Compatibilidade com a VPS existente

Este procedimento segue a arquitetura de [credit-guard-ci-cd](https://github.com/marcelomatheus/credit-guard-ci-cd), especialmente o `compose.production.yaml` e o stack de borda em `infra/compose.yaml`. Ele reutiliza o **Traefik v3 e o Cloudflare Tunnel já ativos**. Não sobe novos containers de Traefik ou `cloudflared`, não instala Tailscale, não publica imagens no Docker Hub e não implementa CI/CD de deploy.

| Propriedade | Configuração |
|---|---|
| Projeto Docker Compose | `pivonauta-prod` |
| Rede compartilhada de borda | `celo-network` (ajustável por `PROXY_NETWORK`) |
| EntryPoint Traefik | `web` (ajustável por `TRAEFIK_ENTRYPOINT`) |
| Router e service exclusivos | `pivonauta` |
| Frontend Nginx + React | Porta interna **18473** |
| Backend FastAPI | Porta interna **19483** |
| Portas publicadas no host | **Nenhuma** |
| Comunicação web → API | Rede privada interna do projeto |
| TLS público | Terminado no Cloudflare |
| Imagens | Construídas localmente na VPS com `docker compose up --build` |

As portas 18473 e 19483 são intencionalmente diferentes das portas 80, 8000, 8080 e 3016 usadas em outros contextos. Mesmo assim, a proteção principal contra conflitos é não publicar portas no host. Como o Traefik já compartilha a rede `celo-network`, ele alcança diretamente o Nginx pela porta 18473. Apenas o Nginx se conecta à rede interna da API.

## Preparação inicial

Na VPS, use um diretório separado daquele do credit-guard, como `/opt/pivonauta`. Use a identidade de deploy já autorizada a operar o Docker; ela deve ser tratada como privilegiada.

```bash
git clone https://github.com/marcelomatheus/pesquisa-operacional.git /opt/pivonauta
cd /opt/pivonauta
cp .env.production.example .env.production
chmod 600 .env.production
```

Edite `.env.production`:

```dotenv
DOMAIN_NAME=pivonauta.seu-dominio.com
PROXY_NETWORK=celo-network
TRAEFIK_ENTRYPOINT=web
```

Defina um **hostname próprio** do PivôNauta, distinto do hostname do credit-guard. Não coloque `https://`, path ou barra final em `DOMAIN_NAME`. O arquivo `.env.production` fica ignorado pelo Git e não deve ser enviado ao repositório.

Verifique se o edge existente está ativo:

```bash
docker network inspect celo-network
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

Se a rede tiver outro nome, use esse nome em `PROXY_NETWORK`; não recrie a rede existente. Não execute `docker compose down` no diretório da infraestrutura compartilhada.

## Rota no Cloudflare Tunnel

No painel do túnel remotamente gerenciado que já serve o credit-guard, adicione um novo **Public Hostname**:

- **Hostname:** o mesmo configurado em `DOMAIN_NAME`.
- **Serviço/origin:** `http://traefik:80`, conforme o stack de referência.
- **HTTP Host Header:** não sobrescrever; preservar o hostname original para o Traefik corresponder à regra `Host(...)`.
- **TLS:** HTTPS público terminado no Cloudflare, com comunicação HTTP apenas na rede Docker entre `cloudflared` e Traefik.

Não é necessário configurar um novo túnel nem token. Não habilite `tls=true` no router da aplicação se o entrypoint compartilhado `web` continuar sendo HTTP interno. O certificado público é gerenciado pelo Cloudflare.

## Deploy manual

A partir do diretório do PivôNauta:

```bash
docker compose --env-file .env.production -f compose.production.yaml config --quiet
bash scripts/deploy_manual.sh
```

O script valida o Compose, compila as imagens **na própria VPS**, inicia a API, aguarda os healthchecks do Docker, inicia o Nginx e valida a rota interna `/api/v1/health/ready`. Não modifica nem reinicia Traefik, Cloudflare Tunnel ou serviços de outros projetos.

Para passar um arquivo de ambiente em outro caminho:

```bash
bash scripts/deploy_manual.sh /caminho/privado/pivonauta.env
```

O nome fixo `pivonauta-prod` evita que o Compose reutilize o projeto Docker do credit-guard. Os routers e serviços `pivonauta` são exclusivos e não substituem `pipeline-credit-api`.

## Corrigir/reiniciar somente o frontend Nginx (read-only)

O container `web` executa com `read_only: true`, `cap_drop: ALL` e `user: "101:101"`. A configuração principal do Nginx direciona o PID para `/tmp/nginx.pid` e define explicitamente `client_body_temp_path`, `proxy_temp_path`, `fastcgi_temp_path`, `uwsgi_temp_path` e `scgi_temp_path` em `/tmp/nginx`. O inicializador cria essas pastas no `tmpfs` antes de iniciar o processo. **Não é necessário montar ou alterar permissões de `/var/cache/nginx`.**

Após mesclar a correção no repositório e atualizar a cópia existente da VPS:

```bash
cd /opt/pivonauta
git pull --ff-only
bash scripts/redeploy_web.sh
```

O comando primeiro exige que a API existente esteja `healthy`. Em seguida executa exclusivamente:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  up -d --build --no-deps --force-recreate --wait web
```

A API **não é reconstruída, reiniciada ou recriada**. O script verifica que seu ID de container permanece igual, valida o `web` como saudável, o filesystem somente leitura, o usuário sem privilégios, os diretórios temporários, `GET /`, `GET /api/v1/health/ready` e a ausência de reinícios. Por fim executa `scripts/smoke_production.py` contra **o domínio HTTPS publicado**, usando o `DOMAIN_NAME` definido em `.env.production`.

Se quiser explicitar o domínio ou usar outro arquivo de ambiente:

```bash
PIVONAUTA_URL=https://pivonauta.seu-dominio.com \
  bash scripts/redeploy_web.sh /opt/pivonauta/.env.production
```

O smoke exige conectividade HTTP ao domínio público. Se o Cloudflare Access exigir login interativo, execute o teste com acesso autorizado ou realize a verificação do domínio em um contexto de rede autenticado; não exponha a aplicação removendo controles de acesso só para satisfazer o teste.

Para inspecionar erros de boot e saúde sem afetar a API:

```bash
docker compose --env-file .env.production -f compose.production.yaml logs --tail 100 web
docker compose --env-file .env.production -f compose.production.yaml ps
```

A CI tem um teste dedicado (`readonly_web`) que inicia o **Compose de produção** com um simulacro da rede Traefik, confere estado `healthy`, `RestartCount=0`, temporários em `/tmp`, refaz somente o container web e executa um smoke real de HTML, Simplex e PDF. Essa validação em container **não substitui a verificação operacional do domínio publicado na VPS**.

## Verificação após deploy

Verifique o estado dos containers:

```bash
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --tail 100 api web
```

Teste o hostname público pelo mesmo smoke test já existente:

```bash
PIVONAUTA_URL=https://pivonauta.seu-dominio.com python3 scripts/smoke_production.py
```

Esse smoke test acessa a landing page, consulta a API pelo mesmo domínio, resolve o exemplo Wyndor com `Z=36` e baixa um relatório PDF. Se o acesso interno funcionar, mas o público falhar, confirme a configuração do Cloudflare Tunnel, o hostname e a regra Traefik, sem reiniciar serviços compartilhados precipitadamente.

Como o PivôNauta não exige autenticação na v1, recomenda-se proteger o hostname com **Cloudflare Access** ou limitar o acesso ao público da disciplina. Os processos possuem limites de memória, CPU e PIDs, mas isso não substitui proteção contra abuso e rate limiting na borda.

## Atualizações e recuperação

Para atualizar a aplicação, obtenha o código revisado e repita o deploy:

```bash
cd /opt/pivonauta
git pull --ff-only
bash scripts/deploy_manual.sh
```

Não há Docker Hub, push automático, tagging automático ou GitHub Actions de publicação. As imagens são construídas localmente. Não use `docker compose down --volumes` para atualizar.

Se uma alteração comprometer a aplicação, volte a um commit ou tag revisado e execute novamente o script. Esse processo **não oferece rollback automático nem zero downtime**. Uma atualização pode causar breve interrupção.

Para parar apenas o PivôNauta, sem afetar o edge:

```bash
docker compose --env-file .env.production -f compose.production.yaml down
```

Esse comando usa o projeto Compose `pivonauta-prod` e não remove a rede externa compartilhada.

## Observações sobre segurança e arquitetura

O Nginx está nas redes `proxy` e `backend`; o FastAPI fica somente em `backend`, uma rede interna isolada. A VPS não recebe listeners adicionais para a aplicação. Os containers usam capacidades reduzidas, filesystem somente leitura com diretórios temporários dedicados, limites de recursos, logs rotacionados e healthchecks.

O Docker socket permanece exclusivamente com o Traefik já existente na VPS; o PivôNauta não monta esse socket. O frontend usa `/api/v1` como rota relativa, evitando configurações CORS complicadas e mantendo frontend e API no mesmo hostname.

O arquivo `compose.yaml` original e o Nginx de desenvolvimento permanecem disponíveis para o smoke local em `http://localhost:8080`. O deploy manual usa exclusivamente `compose.production.yaml` e `deploy/nginx.production.conf`.

A validação estática do Compose pode ser executada por `docker compose --env-file .env.production.example -f compose.production.yaml config --format json`. A configuração real da VPS e a rota externa devem ser verificadas após implantar.
