# PivôNauta 2.1 — protótipo navegável

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

## Como executar

É necessário ter o [Node.js](https://nodejs.org/) 20 ou superior instalado.

### Opção rápida

- Windows: execute `iniciar.bat`.
- macOS/Linux: execute `./iniciar.sh`.

Os scripts instalam as dependências quando necessário e abrem o servidor local em `http://localhost:4173`.

### Pelo terminal

```bash
npm install
npm run dev
```

Depois, acesse `http://localhost:4173`.

## Comandos

```bash
npm run dev      # ambiente local
npm run build    # gera versão de produção em dist/
npm run preview  # visualiza a versão de produção
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

Gráficos dinâmicos da região viável, análise tabular dual e diagnóstico de ótimos múltiplos ainda não utilizam o motor matemático e por isso são apresentados como **pendentes**, sem valores inventados. O relatório atual exporta um TXT baseado nos tableaux calculados; a exportação PDF virá em etapa posterior.

Os exemplos em `src/data.js` ainda contêm valores históricos de demonstração, mas estes não são usados nas telas de resultado integradas. Os cálculos são sempre obtidos do backend.

