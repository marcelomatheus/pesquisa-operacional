# PR #11 — Confiabilidade matemática e contratos do backend

## Motivação

O backend v1 possui Simplex tabular de duas fases, Branch and Bound manual, dualidade, diagnóstico de ótimos múltiplos, primitivas geométricas e geração de PDF. A auditoria de 21/11/2026 identificou uma falha funcional: o esquema público permite 30 restrições, porém um dual com mais de 10 variáveis era recusado pelo domínio, inviabilizando o endpoint dual e relatórios completos de modelos válidos.

Este PR corrige o defeito e melhora limites, explicabilidade e regressões matemáticas. Não troca os algoritmos autorais por bibliotecas matemáticas.

## Alterações matemáticas

### Limites internos e externos

- O esquema Pydantic de entrada continua limitado a **10 variáveis e 30 restrições**, como o editor do PivôNauta.
- O domínio passa a permitir **até 40 variáveis internas**, necessárias a 30 restrições originais mais até 10 limites superiores transformados em linhas do primal para construção do dual.
- O domínio mantém limite de **100 restrições internas** para as ramificações de Branch and Bound. A mensagem de validação reflete o limite real.
- Se um caminho de ramificação atingir esse limite, a busca retorna `constraint_limit`, sem falso certificado de otimalidade.

### Branch and Bound

As relaxações continuam sendo resolvidas pelo Simplex próprio. O algoritmo rastreia um limite herdado para cada nó ainda pendente. Quando o processamento é interrompido por tempo ou número de nós e existe limite finito conhecido para toda a fronteira, informa o `best_bound` global seguro. Se houver incumbente, calcula um gap relativo conservador:

- Maximização: `max(0, best_bound - incumbent) / max(1, abs(incumbent))`.
- Minimização: `max(0, incumbent - best_bound) / max(1, abs(incumbent))`.

Quando não existe um limite seguro, `best_bound` e `optimality_gap` continuam nulos. Mesmo com gap parcial igual a zero, o status só será `optimal` após a conclusão das verificações do algoritmo; nenhum encerramento prematuro é promovido a certificado de ótimo.

O retorno também passa a oferecer `best_rounding_candidate`: melhor candidato **viável dentre os arredondamentos explicitamente testados**, sem garantias globais de ótimo. Os campos anteriores não foram removidos.

### Ótimos alternativos e geometria

A exploração de bases de custos reduzidos nulos passou a respeitar o orçamento de tempo total, inclusive após o Simplex inicial. Ao esgotar o prazo, retorna `undetermined` sem certificar unicidade. O motor geométrico compartilha um único prazo entre a verificação de viabilidade e o cálculo do objetivo.

### Relatórios

`report_data.py` passa a distribuir um orçamento total de **25 segundos** pelos algoritmos das seções selecionadas. Quando o orçamento se esgota, omite novas análises e identifica a situação no documento em vez de falhar silenciosamente. O PDF passa a apresentar o melhor limite global parcial, o gap relativo e o melhor arredondamento viável testado, sem confundi-los com ótimo certificado.

O limite é cooperativo: não interrompe de forma preemptiva processos de renderização ReportLab ou syscalls do servidor. Para exposição pública, ainda convém ter limites de concorrência/timeout no proxy e proteção no Cloudflare.

## API e segurança

- O middleware lê corpos HTTP **por chunks**, interrompendo quando a soma excede 100 KB. Não usa `request.body()` para só então verificar tamanho. A mensagem de 413 continua no formato Problem Details.
- Um `BoundedSemaphore(4)` limita a **quatro cálculos simultâneos por processo**. Requisições adicionais recebem HTTP 429 com `code=SOLVER_BUSY`; o semáforo é liberado em `finally`.
- Os principais endpoints JSON agora expõem modelos tipados de resposta no OpenAPI: solução, nós, candidatos inteiros, dual, alternativas, geometria, forma padrão e validação.
- O endpoint PDF continua binário e declara o MIME `application/pdf` na especificação.
- Não foram acrescentados autenticação, armazenamento de usuários ou rate limiting por IP. O deployment acadêmico público deve usar **Cloudflare Access/rate limiting no edge** e firewall já existentes; CORS por si só não é controle de autenticação.
- A limitação de quatro slots é por processo Uvicorn, não distribuída entre múltiplas réplicas.

## Evidências automatizadas

1. `test_dual_scale.py`: modelo com 11, 20 e 30 restrições, caso extremo de **40 variáveis duais**, resposta da API e rejeição de 11 variáveis na entrada pública.
2. `test_math_reliability.py`: limite global do BnB em interrupções, arredondamentos, prazo das bases alternativas e conservação da certificação após busca completa.
3. `test_property_regression.py`: 150 problemas lineares com enumeração geométrica independente, 50 problemas inteiros com enumeração exaustiva e 30 casos de dualidade gerados com sementes fixas.
4. `test_solver_oracle.py`: **45 LPs** comparados com `scipy.optimize.linprog(method="highs")` e **25 MILPs** comparados com `scipy.optimize.milp`. SciPy é extra opcional **`[oracle]`** de desenvolvimento e não está instalado na imagem Docker de produção.
5. `test_api_contracts.py`: schemas OpenAPI, compatibilidade JSON, corpo HTTP excedente e resposta 429 sob saturação.
6. `test_report_reliability.py`: PDF com dual acima de dez restrições e problema inviável.
7. A CI roda `ruff check src tests --select E4,E7,E9,F`, `compileall`, `pytest` e um job isolado de comparação com SciPy, além dos testes Node/Playwright já existentes.

## Execução local

```bash
cd backend
python -m pip install -e ".[dev]"
ruff check src tests --select E4,E7,E9,F
pytest -q
```

Para executar também os oráculos externos, apenas no **ambiente de testes**:

```bash
python -m pip install -e ".[dev,oracle]"
pytest -q tests/test_solver_oracle.py
```

A aplicação em produção continua usando apenas FastAPI, Pydantic, Uvicorn, ReportLab e os algoritmos próprios.

## Limitações remanescentes

- O Simplex utiliza `float` e tolerâncias; entradas extremamente mal condicionadas ainda podem demandar ajustes específicos.
- As análises são síncronas e seus limites dependem de verificações cooperativas. Não existe fila distribuída, API de jobs nem interrupção preemptiva da composição PDF.
- Os schemas tipam os resultados principais; estruturas detalhadas dos tableaux e primitivas geométricas permanecem dicionários extensíveis para preservar compatibilidade.
- A busca inteira usa exploração em profundidade e limites herdados, não implementação avançada de cut generation ou heurísticas comerciais.
- A malha geométrica de inteiros continua limitada a dois eixos e pode ser amostrada.
- O backend não implementa autenticação de usuários nem sincronização de modelos. Na v1, o estado persistente permanece no IndexedDB do navegador.
- É necessário validar implantação pública e políticas do Cloudflare na VPS; CI não equivale a teste operacional do servidor real.

## Critérios de aceite

- O dual aceita todo modelo da API dentro dos limites de 10 variáveis e 30 restrições, incluindo limites superiores.
- Uma interrupção não produz certificado de ótimo e apresenta o melhor limite seguro quando disponível.
- A análise de múltiplos ótimos não certifica unicidade após esgotar o prazo.
- Os resultados HTTP continuam compatíveis com os consumidores React existentes.
- O PDF não deixa de gerar por restrições extras no dual e distingue arredondamentos de ótimos certificados.
- Testes backend, análise estática, oráculos opcionais, build frontend e E2E sem falhas.
