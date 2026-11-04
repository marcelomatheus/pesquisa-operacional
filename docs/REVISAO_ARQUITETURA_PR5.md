# Revisão de arquitetura — PR #5 do PivôNauta

**Base de integração:** `main` após PR #4, commit `17611890178314e64ddccdb0372ac08eebfbe35c`.

## Objetivo e método

Esta revisão examina os limites entre domínio matemático, orquestração da aplicação, componentes visuais e persistência. O objetivo não é substituir a arquitetura já construída, mas reduzir duplicações e permitir a inspeção de um cálculo verificável com a entrega acadêmica de 04/12/2026.

## Diagnóstico de responsabilidades antes do PR

| Módulo | Acoplamento identificado | Consequência | Correção aplicada |
|---|---|---|---|
| `src/App.jsx` | Guarda modelo, rascunho, histórico, execução, estados da UI e WebMCP | Grande componente de orquestração; risco de regressão | Adaptação de eventos isolada em `solverEvents.js`; seleção tipada em `selection.js`. A extração completa de hooks permanece posterior |
| `src/components/AppShell.jsx` | Renderiza navegação, console, Inspector e comandos; seleção era texto | Alterações no console/Inspector exigiam editar o shell inteiro | `MathConsole.jsx` e `InspectorPanel.jsx` extraídos com props explícitas |
| `src/screens/LiveResults.jsx` e `MathAnalysis.jsx` | Dois renderizadores de tableau com navegação distinta | Experiências primal e dual divergentes | `TableauViewer.jsx` compartilhado, com operações reais e seleção de células |
| `src/screens/Review.jsx` | Descrição textual da forma padrão sem dados reais | Impossibilidade de auditar a normalização | `StandardFormPreview.jsx` consulta a mesma transformação usada pelo Simplex |
| `backend/src/pivonauta/simplex.py` | Matrizes e pivôs disponíveis, mas sem operações de linha discriminadas | UI teria que reconstruir a álgebra ou mostrar passos incompletos | `tableau_trace.py` extrai operações numéricas sem alterar o algoritmo; snapshots passam a incluir operações e custos reduzidos |
| `backend/src/pivonauta/main.py` | API não expunha forma padrão | Frontend não podia explicar shifts/bounds/folgas | `POST /api/v1/models/standard-form` delega a `standardize()` por meio de `standard_form.py` |

## Dependências e fluxo de dados

```text
Editor / Inspector
       │
       ▼
model.js (modelo canônico) ──► solverApi.js ──► FastAPI
                                           │
                          ┌────────────────┴─────────────┐
                          ▼                              ▼
                   simplex.py                      standard_form.py
                          │                              │
                   tableau_trace.py                 standardize()
                          │
                          ▼
                     resposta JSON
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
        TableauViewer              solverEvents.js
             │                         │
             ▼                         ▼
        seleção tipada              MathConsole
             │                         │
             └──────────┬──────────────┘
                        ▼
                  InspectorPanel
```

**Invariantes:**

1. O frontend não executa pivoteamento, teste da razão ou transformação para forma padrão; somente exibe fatos computados pelo motor.
2. `tableau_trace.py` é funcional e independente de FastAPI. O módulo não invoca outro solver, não modifica o tableau e não altera as decisões de pivô.
3. `standard_form.py` utiliza a própria função `simplex.standardize`, evitando uma implementação paralela e divergente.
4. O resultado matemático continua vinculado ao fingerprint da formulação, não ao título do modelo.
5. Eventos exibidos após a resolução são **derivados da resposta concluída da API**, não logs transmitidos ao vivo. Ao reabrir a aplicação, eventos de execuções persistidas são reconstruídos para consulta.
6. A seleção guarda contexto tipado (`model`, `objective`, `variable`, `constraint`, `tableau`, `branch_node`). O Inspector nunca presume que o título de uma seleção identifica a entidade.
7. Se um valor matemático não está disponível, a interface apresenta ausência de dados em vez de completar com resultados ilustrativos.

## Contratos introduzidos

**`POST /api/v1/models/standard-form`** recebe o mesmo `{model: ...}` validado por `ModelRequest` e devolve colunas, custos transformados, origem de cada equação, bases iniciais, artificiais, mapeamento de reconstrução e deslocamento do objetivo. Não altera nem substitui o endpoint de validação estrutural.

**`POST /api/v1/solves`** preserva os campos `status`, `objective_value`, `variables`, `iterations`, `pivot_count` e `message`. Cada snapshot de `iterations[]` recebe opcionalmente `row_operations[]` e `reduced_costs[]`. As operações contêm índices das linhas, fator, linha anterior e resultado da operação. Clientes existentes continuam compatíveis.

**Eventos de console** são projeções dos objetos `iterations[]` e `nodes[]`. A pesquisa, a severidade, o filtro de método e a navegação não são atributos do domínio matemático.

## Riscos, pontos de atenção e decisões adiadas

| Tema | Avaliação | Ação futura |
|---|---|---|
| Orquestrador React (`App.jsx`) | Continua centralizado, embora sem renderização do console/Inspector | Separar hooks para ciclo de execução, persistência e estado de seleção após PR #6 |
| Seleção por snapshot | O estado pode incluir uma cópia do tableau selecionado | Substituir por IDs/referências à execução se houver pressão de memória em modelos grandes |
| Trilha pedagógica | As operações de linha são calculadas como projeção do tableau anterior ao pivoteamento | Criar testes de regressão com degenerescência e restrições redundantes; tratar tolerâncias numéricas |
| Execuções históricas | IndexedDB mantém histórico limitado de execuções; o console restaura parte dos eventos | Evoluir paginação/exportação histórica se necessário; evitar armazenamento ilimitado de tableaux |
| Streaming | Não há WebSocket/SSE; console é preenchido após o cálculo HTTP | Não anunciar streaming ao vivo. Incremento opcional se não comprometer prazo |
| Backend em produção | A API e o frontend ainda precisam de verificação E2E/deploy | PR #8, com configuração de URL, CORS e inicialização |
| Análises adicionais | PDFs, curvas de nível e árvore gráfica detalhada ainda são pendentes | PRs #6 e #7 |
| Legado | `Results.jsx`, `FeasibleGraph.jsx` e dados demonstrativos permanecem no repositório | Limpeza controlada no PR #8, após certificação de que não são importados pelas rotas |

## Validação exigida

- Reproduzir cada operação elementar do tableau e comparar o resultado da rodada seguinte.
- Confirmar a forma padrão para modelo com variável livre, limites inferiores e superiores e RHS negativo.
- Garantir que `include_trace=False` não monte operações desnecessárias.
- Cobrir navegação da mensagem de console para a etapa tabular certa.
- Inspecionar uma restrição ativa e outra com folga, uma variável inteira e um nó de Branch and Bound.
- Validar responsividade do Inspector e do console em navegador real antes do congelamento funcional.
- Confirmar aprovação dos jobs `frontend` e `backend` no GitHub Actions.

## Estratégia de commits do PR #5

1. `refactor(frontend): extrair inspector console e tableau compartilhado` — separação de componentes e reaproveitamento no primal/dual.
2. `feat(backend): expor forma padrao e operacoes de linha` — extensão aditiva dos contratos matemáticos.
3. `feat(frontend): ligar eventos e selecao contextual` — estado global, seleção do editor, consultas e estilos.
4. `test: cobrir trilha matematica selecao e eventos` — testes do motor e dos adaptadores.
5. `docs: registrar revisao arquitetural do pr5` — decisões, limites e critérios de aceite.

Nenhum commit realiza merge. O PR deve permanecer em rascunho até obter resultados de CI verificáveis.
