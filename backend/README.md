# PivôNauta Backend (Python puro)

API FastAPI para resolver Programação Linear por **Simplex tabular de duas fases** e
Programação Inteira por **Branch and Bound próprio**, reutilizando nosso Simplex.

Não utiliza `numpy`, `scipy`, `pulp`, `ortools` ou qualquer biblioteca de otimização no motor.

## Executar

```bash
cd backend
python -m venv .venv
# Linux / macOS: source .venv/bin/activate
# Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn pivonauta.main:app --reload --port 8000
```

Documentação interativa: http://localhost:8000/docs

Testes: `pytest -q`

## Contratos

- `POST /api/v1/models/validate`: validação estrutural, sem afirmar viabilidade matemática.
- `POST /api/v1/solves`: resolução contínua e **todos os tableaux reais**.
- `POST /api/v1/solves/integer`: busca Branch and Bound real e candidatos por arredondamento.
- `GET /api/v1/health/live`, `GET /api/v1/health/ready`.

`model` contém `name`, `sense` (`min` / `max`), `objective`, `variables` e `constraints`.
Operadores: `le`, `ge`, `eq`. `variables[].domain`: `continuous` ou `integer`.
Limites default: `lower_bound: 0`, `upper_bound: null`; `lower_bound: null` indica variável livre.

A API não declara ótima uma busca inteira interrompida por limite de tempo/nós. `rounded_candidates`
são apenas candidatos testados, **não soluções ótimas garantidas**.

## Análises matemáticas complementares

Os seguintes endpoints usam **somente Python puro** no domínio matemático:

- `POST /api/v1/solves/dual`: constrói o dual de problemas de minimização ou maximização,
  resolve primal e dual com Simplex próprio, compara objetivos e verifica
  complementaridade. O retorno inclui o modelo dual e os tableaux do dual.
- `POST /api/v1/solves/alternatives`: explora bases de custo reduzido nulo e
  somente declara `multiple` ao encontrar um vetor ótimo distinto e viável.
  Resultados `undetermined`/`not_certified` não são provas de unicidade.
- `POST /api/v1/geometry`: calcula restrições, interseções, vértices, região
  recortada à janela de visualização e boundedness para exatamente duas variáveis.
  O polígono de exibição de uma região ilimitada **não** é a região matemática toda.

Os resultados duais se referem à relaxação linear contínua. Ao converter limites
inferiores não nulos, é retornado `objective_offset` para reconstruir o objetivo
original do dual. O campo `dual_model.source_rows` identifica restrições derivadas
de limites superiores de variáveis.

### Testes

```bash
cd backend
pytest -q
```

Há testes unitários para radioterapia, Wyndor, variáveis livres e com limites,
regiões de dimensão 0/1/2, regiões ilimitadas, modelos inviáveis e bases degeneradas.


## Inspeção pedagógica da forma padrão e dos pivôs

- `POST /api/v1/models/standard-form` recebe `{ "model": ... }` e devolve colunas normalizadas, linhas, bases, origem das restrições, variáveis auxiliares e reconstrução do modelo original.
- Os snapshots de `POST /api/v1/solves` preservam o contrato existente e passam a incluir `row_operations[]` e `reduced_costs[]` quando `include_trace=true`.
- Cada operação contém o tipo (`scale` ou `eliminate`), a linha-alvo, a linha-fonte, o fator multiplicativo e os vetores antes/depois. Essas informações são projeções da mesma matriz usada pelo Simplex, não cálculos independentes.
- Com `include_trace=false`, não são montadas matrizes pedagógicas extras. O motor permanece em Python puro e sem dependências de bibliotecas de otimização.

Execute `pytest -q` em `backend/` para validar a consistência da trilha e a forma padrão.


## Sobreposições geométricas do PR #6

`POST /api/v1/geometry` pode receber `options` com `show_integer_lattice`, `force_all_integer` e `max_integer_points`. Retorna `level_lines` (isolinhas `c·x = k` recortadas ao viewport), `optimal_face` (segmento de ótimo na região quando existir) e `integer_lattice` (amostra de pontos inteiros viáveis, com sinalização de truncamento por stride). Esses campos não substituem a prova de otimização inteira.

Cada nó do Branch and Bound agora inclui `branch_decision` estruturada, que permite reconstruir a relaxação linear no frontend e resolvê-la sob demanda com o próprio Simplex.


## Relatórios acadêmicos em PDF

`POST /api/v1/reports/pdf` recebe `model` no mesmo formato dos outros endpoints e um objeto opcional `options` com `sections`, `max_tableaux`, `max_nodes` e `integer_mode`. O serviço devolve o arquivo `application/pdf`, com `Cache-Control: no-store`.

`sections` aceita `model`, `simplex`, `integer`, `geometry`, `dual` e `alternatives`. O resumo executivo é sempre incluído. `max_tableaux` varia de 1 a 100, e `max_nodes` de 1 a 200. `integer_mode` pode ser `declared` ou `all_integer`.

A camada `report_data.py` invoca os algoritmos próprios; `report_pdf.py` compõe texto e tabelas; `report_graphics.py` desenha gráficos vetoriais. ReportLab não executa otimização matemática. Casos não certificados e capítulos não aplicáveis são identificados no PDF.

Teste com `pytest -q`, incluindo `tests/test_report_pdf.py`; as verificações incluem leitura do PDF com `pypdf`.

## Confiabilidade e segurança — PR #11

O domínio admite até **40 variáveis internas** para suportar o dual de até **30 restrições públicas mais 10 limites superiores**. A API continua aceitando até 10 variáveis originais e 30 restrições. O Branch and Bound informa limites globais seguros e gap relativo quando uma busca é interrompida; `best_rounding_candidate` escolhe apenas o melhor candidato viável dentre os arredondamentos testados, sem provar ótimo.

Os endpoints JSON publicam schemas tipados no OpenAPI. Um orçamento de quatro requisições de cálculo simultâneas por processo devolve HTTP 429 (`SOLVER_BUSY`) ao ser excedido. O middleware rejeita corpos HTTP superiores a 100 KB durante a leitura. A geração de relatórios dispõe de orçamento total de processamento e identifica análises interrompidas.

Validação local:

```bash
python -m pip install -e ".[dev]"
ruff check src tests --select E4,E7,E9,F
pytest -q
```

Validação matemática independente, apenas no ambiente de teste:

```bash
python -m pip install -e ".[dev,oracle]"
pytest -q tests/test_solver_oracle.py
```

SciPy é uma dependência opcional **dos testes**, nunca do aplicativo de produção. Consulte [Revisão do backend PR #11](../../docs/REVISAO_BACKEND_PR11.md) para detalhes, limites e riscos.
