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

## Próximas etapas

- Dualidade e ótimos alternativos com certificação completa.
- Primitivas geométricas reais e integração com `FeasibleGraph`.
- Relatórios exportáveis e integração integral do frontend.
- Limites operacionais de execução e testes E2E.

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
