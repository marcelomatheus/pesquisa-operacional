# PivôNauta — Pesquisa Operacional, versão 1.0

O **PivôNauta** é um laboratório acadêmico para criar, validar, resolver, inspecionar, visualizar e documentar problemas de programação linear e inteira. Os algoritmos **Simplex tabular de duas fases e Branch and Bound são implementados manualmente em Python puro**, sem SciPy, NumPy ou solvers externos.

## O que está implementado

- **Editor visual, algébrico e JSON:** até 10 variáveis, 30 restrições, limites individuais e domínios contínuos/inteiros ou mistos.
- **Importação, exportação e biblioteca:** validação antes de aplicar alterações, rascunho local e modelos salvos no IndexedDB.
- **Simplex:** fases I e II, tableaux auditáveis, pivôs, razão mínima, custos reduzidos e operações elementares.
- **Branch and Bound:** nós, decisões de ramificação, podas, candidatos arredondados e inspeção da relaxação de um nó.
- **Geometria:** região viável bidimensional, vértices, curvas de nível, ótimo contínuo, ótimo inteiro e múltiplos ótimos certificados.
- **Dualidade e diagnósticos:** modelo dual, tableaux, dualidade forte, complementaridade e análise de soluções ótimas alternativas.
- **Inspector e console:** propriedades contextuais e eventos matemáticos derivados das execuções.
- **PDF acadêmico:** formulação, soluções, tableaux, árvore, gráfico vetorial, dual e diagnósticos, com indicação de resultados não certificados.

A interface não utiliza valores demonstrativos para declarar resultados matemáticos. A landing page conserva animações ilustrativas, separadas do solucionador.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React, Vite, React Router, Framer Motion |
| API | FastAPI e Pydantic |
| Motor matemático | Python puro |
| Relatórios | ReportLab, apenas para composição de documentos |
| Persistência v1 | IndexedDB no navegador |
| Publicação unificada | Docker Compose, Nginx e Uvicorn |
| Qualidade | pytest, testes Node, Playwright, validação visual de PDFs |

## Iniciar no ambiente de desenvolvimento

Requisitos: Python 3.11+ e Node.js 20+.

```bash
# Windows
iniciar.bat

# Linux/macOS
./iniciar.sh
```

O script cria o ambiente Python, instala as dependências necessárias, inicia a API em `127.0.0.1:8000` e o frontend em `http://localhost:4173`. Para iniciar manualmente, use dois terminais:

```bash
cd backend
python -m venv .venv
# Ative .venv de acordo com o sistema operacional
pip install -e ".[dev]"
uvicorn pivonauta.main:app --port 8000
```

```bash
npm ci
npm run dev
```

## Iniciar como aplicação integrada

Com Docker Compose disponível, na raiz do repositório:

```bash
docker compose up -d --build
```

Abra **http://localhost:8080**. O Nginx serve o frontend compilado e encaminha `/api/` ao serviço FastAPI na rede interna do Compose. Verifique:

```bash
python scripts/smoke_production.py
```

Para encerrar:

```bash
docker compose down
```

A porta HTTP padrão pode ser alterada com `PIVONAUTA_PORT`. Esta configuração é adequada a demonstrações e ambientes controlados. Para expor o sistema publicamente, configure HTTPS em um proxy ou plataforma segura, domínios e políticas operacionais.

### Publicação em serviços separados

Defina `VITE_API_URL=https://sua-api.example/api/v1` antes de compilar o React, e configure `PIVONAUTA_ALLOWED_ORIGINS=https://seu-frontend.example` no backend. São permitidas múltiplas origens separadas por vírgula; não utilize `*` indiscriminadamente.

**Importante:** um build Vercel aprovado não prova que uma API Python está publicada. O deploy público de frontend e backend deve ser verificado na infraestrutura escolhida.

## Validar a v1

```bash
npm ci
npm test
npm run build

cd backend
pip install -e ".[dev]"
pytest -q
```

Testes em navegador exigem Chromium e Playwright:

```bash
npm install --no-save --package-lock=false @playwright/test@1.56.1
npx playwright install chromium
python scripts/run_e2e.py
```

A CI executa os testes de backend/frontend e também a suíte Playwright em viewport desktop e mobile, uma pré-verificação de PDFs renderizados e um smoke test em containers. Os artefatos das execuções ficam na aba [Actions](https://github.com/marcelomatheus/pesquisa-operacional/actions).

Para gerar amostras visuais de PDF localmente, instale `pymupdf` e execute `python scripts/validate_pdf_visual.py`.

## Fluxo recomendado para o seminário

1. Importe ou selecione o modelo **Wyndor**.
2. Confirme `max Z = 3x1 + 5x2` e suas três restrições.
3. Execute o Simplex e confira `x1 = 2`, `x2 = 6` e `Z = 36`.
4. Inspecione tableaux, pivôs, razão mínima e o console.
5. Abra o gráfico com curvas de nível e a região viável.
6. Execute Branch and Bound e inspecione os nós.
7. Compare o primal e o dual; consulte ótimos alternativos.
8. Exporte e visualize o relatório PDF.

O exemplo **Radioterapia** permite demonstrar a diferença entre soluções contínuas e inteiras: mínimo contínuo `5,25`, ótimo inteiro `5,30`.

## Limitações e advertências da v1

- O gráfico matemático está disponível apenas para modelos com exatamente duas variáveis.
- Os modelos e o histórico são armazenados **localmente no navegador**, sem conta ou sincronização. Exporte JSON como cópia de segurança.
- O número de iterações, nós, tempo de execução e tamanho dos modelos é limitado para preservar recursos.
- Em interrupções por limite, os candidatos inteiros não são apresentados como ótimos certificados.
- A malha inteira pode ser amostrada, e isso é informado; não é prova de otimalidade.
- Eventos do console são disponibilizados após a resposta HTTP, não via streaming.
- Documentos PDF grandes podem conter muitas páginas quando vários tableaux são solicitados.
- A v1 não inclui autenticação, multiusuário, banco SQL, solvers comerciais nem diagnóstico numérico formal para todos os problemas mal condicionados.

## Organização

```text
backend/src/pivonauta/     Motor matemático, contratos HTTP e relatórios
backend/tests/             Testes do backend
src/screens/               Telas da aplicação
src/components/            Inspector, console, tableaux e gráficos
src/services/              Modelagem, persistência e integração da API
tests/e2e/                 Testes com navegador real
scripts/                   Execução local, validação E2E, PDF e smoke
deploy/                    Nginx e Dockerfile do frontend compilado
docs/                      Planejamento e revisões arquiteturais
```

Documentação adicional: `docs/PLANEJAMENTO_BACKEND.md`, `docs/REVISAO_ARQUITETURA_PR5.md`, `docs/REVISAO_ARQUITETURA_PR6.md`, `docs/REVISAO_ARQUITETURA_PR7.md` e `docs/VALIDACAO_V1.md`.
