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
