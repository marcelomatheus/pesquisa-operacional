# PivôNauta — desenvolvimento da v1.0

Protótipo acadêmico de uma aplicação de Pesquisa Operacional para modelagem e demonstração do método Simplex. A experiência cobre editor algébrico, prova tabular, região de viabilidade, solução inteira, Branch and Bound, modelo dual, casos especiais e relatório.

## Novidade da versão 2.1

- Landing page pública com apresentação do sistema, jornada de análise e estrutura da equipe.
- Visualização animada da região viável, curvas de nível, ponto ótimo e fluxo do tableau.
- Entrada separada para o laboratório, preservando o shell fixo da aplicação.
- Animações infinitas com alternativa estática para usuários que preferem movimento reduzido.

## O que mudou na versão 2.0

- Navegação única e fixa, sem barras duplicadas.
- Console matemático fixo no rodapé da área de trabalho.
- Inspetor funcional com seções recolhíveis e controles editáveis.
- Nova direção visual baseada em uma bancada científica, com IBM Plex e superfícies contínuas.
- Tela inicial ajustada integralmente ao viewport em desktop.
- Troca imediata entre rotas, sempre iniciando no topo da nova página.
- Criação de novo modelo, importação JSON e escolha de domínio funcionais.
- Transformação para forma padrão, ampliação do gráfico e cópia do link funcionais.

## Como executar a aplicação completa

**Pré-requisitos:** Python 3.11+ e Node.js 20+. O motor matemático é implementado em Python puro; FastAPI e Uvicorn são dependências apenas da API.

Execute na raiz do projeto:

```bash
# Windows
iniciar.bat

# macOS/Linux
./iniciar.sh
```

O script cria o ambiente Python em `backend/.venv`, instala dependências necessárias na primeira execução, inicia a API na porta `8000`, verifica `/api/v1/health/ready`, e então inicia o Vite em `http://localhost:4173`. Ctrl+C encerra os dois processos. Caso uma porta esteja ocupada, a inicialização é interrompida com um erro claro.

**Inicialização manual**, caso prefira separar os servidores:

```bash
cd backend
python -m venv .venv
# Ative .venv e instale:
pip install -e ".[dev]"
uvicorn pivonauta.main:app --port 8000
```

Em outro terminal, na raiz: `npm ci && npm run dev`.

## Modelagem da v1 (PR #4)

- Formato JSON versionado com `schema_version: 1`, `variables[]`, `objective[]` e `constraints[]`.
- Até **10 variáveis** e **30 restrições**, com limites inferiores/superiores e domínio contínuo ou inteiro por variável.
- Editor visual dinâmico, parser algébrico linear (`Max Z = 3x1 + 5x2`, `x1 + 2x2 <= 8`) e importador/exportador JSON.
- Importação de modelos do contrato FastAPI, formato canônico e formato de exemplos legado.
- Pré-visualização e validação antes de aplicar JSON/texto; modelo ativo fica intacto se a importação falhar.
- IndexedDB: rascunho restaurável após atualizar, biblioteca de modelos locais e histórico breve de execuções. Os dados permanecem no navegador: **exporte JSON para fazer backup**.
- Geometria é exibida somente para exatamente duas variáveis. Modelos com 1 ou 3–10 variáveis continuam resolvíveis pelos algoritmos, mas não recebem gráficos falsos.

A arquitetura mantém Simplex de duas fases, Branch and Bound, dualidade e geometria implementados manualmente em **Python puro**.

## Comandos de verificação

```bash
npm test
npm run build
cd backend && pytest -q
```

## Jornada sugerida

1. Abra **Biblioteca** e carregue um exemplo.
2. Edite a função objetivo e as restrições.
3. Revise e execute o modelo.
4. Reproduza o Simplex passo a passo.
5. Alterne as camadas do gráfico.
6. Compare arredondamento e Branch and Bound.
7. Explore o dual e os diagnósticos especiais.
8. Monte e exporte o relatório-resumo.

## API matemática e integração

A partir desta etapa, o editor e as páginas de **resumo, Simplex tabular e Branch and Bound** utilizam resultados reais da API Python. O motor de Simplex de duas fases e a busca inteira são implementados manualmente em Python puro, sem NumPy ou SciPy.

Em dois terminais, na raiz do repositório:

```bash
# Terminal 1 — API
cd backend
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows: .venv\\Scripts\\activate
pip install -e ".[dev]"
uvicorn pivonauta.main:app --reload --port 8000
```

```bash
# Terminal 2 — React
npm ci
npm run dev
```

No desenvolvimento, Vite encaminha as requisições de `/api` para `http://127.0.0.1:8000`. Para ambientes separados, defina `VITE_API_URL` com a URL completa do prefixo `/api/v1` antes de executar o build.

### Testes

```bash
npm test
npm run build
cd backend
pytest -q
```

### Funcionalidades ainda em desenvolvimento

As telas de **geometria dinâmica**, **modelo dual tabular** e **ótimos múltiplos** agora consultam três endpoints próprios em Python puro. O frontend distingue cálculos certificados de resultados inconclusivos e deixa claro que polígonos de regiões ilimitadas são apenas recortes da janela de visualização. O relatório atual exporta um TXT baseado nos tableaux calculados; a exportação PDF virá em etapa posterior.

Os exemplos em `src/data.js` ainda contêm valores históricos de demonstração, mas estes não são usados nas telas de resultado integradas. Os cálculos são sempre obtidos do backend.


### Endpoints de análise

- `POST /api/v1/solves/dual`: modelo e tableaux duais, dualidade forte e complementaridade.
- `POST /api/v1/solves/alternatives`: evidência de outros pontos ótimos ou unicidade.
- `POST /api/v1/geometry`: linhas, vértices, polígono de viewport e caráter limitado/ilimitado.


## PR #5 — Inspector, console e tableaux pedagógicos

O Inspector agora permite inspecionar e editar variáveis e restrições individuais, consultar sua atividade/folga após a resolução, e examinar células de tableaux e nós do Branch and Bound. As seleções são identificadas por tipo e ID, e não por textos genéricos.

O console recebe eventos estruturados a partir das respostas matemáticas reais, com pesquisa, filtros por método e severidade, detalhes e navegação para os tableaux correspondentes. Eventos de execuções anteriores podem ser reconstruídos a partir do histórico local do IndexedDB. **Os eventos são disponibilizados após a resposta HTTP e não em streaming durante o processamento.**

O componente de visualização tabular é compartilhado entre o Simplex primal e o dual. Ele apresenta a base, os custos reduzidos, o teste da razão e as operações elementares de linha. A tela de revisão consulta `POST /api/v1/models/standard-form` para exibir a transformação real dos limites, variáveis livres, folgas e artificiais.

Consulte [Revisão de arquitetura — PR #5](docs/REVISAO_ARQUITETURA_PR5.md) para limites e decisões de design.

