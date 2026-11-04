# Planejamento de Backend Profissional — Pivônauta

> **Versão revisada em 04/11/2026 — decisão aprovada:** Simplex tabular (duas fases) e Branch and Bound implementados manualmente em **Python puro**. Sem NumPy, SciPy ou outros solvers na aplicação. FastAPI/Pydantic apenas na camada HTTP. O trabalho de implementação foi autorizado e deverá seguir PRs incrementais, sem merge automático.


## 1. Papel e responsabilidade

Atue como um **Staff Software Engineer, Software Architect e especialista em Python, FastAPI, Domain-Driven Design (DDD), Clean Architecture e Pesquisa Operacional**.

Sua missão é analisar profundamente o repositório existente e elaborar um plano de engenharia para implementar um backend robusto, seguro, escalável, testável e profissional, integrado ao frontend já desenvolvido.

O projeto é um sistema acadêmico de Pesquisa Operacional voltado à resolução de problemas de Programação Linear utilizando o **método Simplex em sua forma tabular**, incluindo recursos de visualização gráfica, análise matemática e geração de relatórios.

Embora seja um projeto acadêmico, sua arquitetura, qualidade de código e práticas de engenharia devem seguir padrões profissionais de produção.

**HISTÓRICO:** a etapa inicial foi exclusivamente de planejamento. Em 04/11/2026, o usuário aprovou explicitamente o início da implementação do backend, mantendo esta especificação como referência e exigindo Simplex e Branch and Bound próprios em Python puro.

**Aprovação para implementação recebida em 04/11/2026.** A execução será incremental por Pull Requests, preservando a branch principal.

---

## 2. Contexto atual

O frontend já está desenvolvido e contém as páginas, os componentes, os fluxos de navegação e as funcionalidades planejadas para o sistema.

Entretanto, o backend ainda não foi implementado.

O backend deverá ser criado **dentro do mesmo monorepo**, preservando a estrutura existente sempre que possível e evitando refatorações desnecessárias do frontend.

O sistema deverá atender aos requisitos estabelecidos pela disciplina de Pesquisa Operacional, cujo prazo final é **04/12/2026**.

### Requisitos funcionais obrigatórios

1. Modelagem de problemas de Programação Linear, com função objetivo, variáveis de decisão, restrições e domínios.
2. Resolução algébrica pelo método Simplex em sua forma tabular.
3. Exibição dos tableaux e das iterações do algoritmo, incluindo operações de pivoteamento.
4. Identificação da solução ótima e do valor da função objetivo.
5. Determinação de uma solução inteira ótima, quando existente.
6. Determinação de uma solução inteira por arredondamento, com verificação de viabilidade.
7. Representação gráfica da região viável para problemas bidimensionais.
8. Representação das curvas de nível da função objetivo.
9. Identificação gráfica da solução ótima.
10. Suporte à resolução de problemas com características semelhantes ao problema radioterápico apresentado na disciplina.
11. Identificação de soluções ótimas múltiplas.
12. Suporte à resolução e à apresentação tabular do problema dual.
13. Representação gráfica de soluções inteiras, quando aplicável.
14. Geração de relatórios contendo o modelo, os cálculos, as iterações, os resultados e as visualizações.
15. Integração completa com os fluxos e funcionalidades já existentes no frontend.

### Bonificações acadêmicas

O projeto deverá contemplar também os requisitos opcionais que oferecem pontuação adicional:

- Solução inteira representada graficamente: +3 pontos.
- Apresentação da solução tabular dual: +4 pontos.
- Identificação e geração de soluções ótimas múltiplas: +3 pontos.

**Trate essas bonificações como funcionalidades prioritárias no planejamento**, considerando o prazo e a complexidade de implementação.

---

## 3. Investigação obrigatória do repositório

Antes de propor qualquer arquitetura, realize uma análise detalhada do código existente.

Investigue:

- Estrutura de diretórios e organização do monorepo.
- Frameworks, bibliotecas e versões utilizadas.
- Configurações de build, lint, testes e desenvolvimento.
- Páginas, rotas e componentes do frontend.
- Fluxos de navegação e jornadas do usuário.
- Tipos, interfaces, schemas e modelos de dados existentes.
- Estados locais, mocks, dados estáticos e serviços simulados.
- Formulários, editores, consoles, dashboards e relatórios.
- Funcionalidades que exigem processamento matemático.
- Pontos de integração que precisarão consumir a API.
- Convenções de código, arquitetura e padrões já estabelecidos.

### Entregável da investigação

Crie uma **matriz de rastreabilidade frontend → backend** contendo:

| Funcionalidade | Localização no frontend | Comportamento esperado | Necessidade de backend | Endpoint proposto | Prioridade |
|---|---|---|---|---|---|

Não invente funcionalidades existentes. Diferencie explicitamente:

- Funcionalidades já implementadas no frontend.
- Funcionalidades apenas simuladas ou representadas por mocks.
- Funcionalidades exigidas pela disciplina, mas ainda ausentes.
- Melhorias opcionais sugeridas.

Toda conclusão sobre o repositório deve indicar os arquivos ou módulos que a fundamentam.

---

## 4. Stack tecnológica

O backend deverá utilizar **Python e FastAPI**, adotando a última versão estável disponível no momento da implementação.

Pesquise e valide as versões estáveis e a compatibilidade das dependências antes de definir a stack definitiva.

Considere:

- FastAPI para a camada HTTP.
- Pydantic v2 para validação e serialização.
- Python moderno com type hints rigorosos.
- Uvicorn como servidor ASGI.
- Dependency Injection para desacoplamento.
- Pytest para testes automatizados.
- HTTPX para testes de integração HTTP.
- Ruff para lint e formatação.
- Mypy ou Pyright para análise estática.
- **Motor matemático em Python puro** (sem NumPy, SciPy, SymPy, PuLP ou outros solvers em produção). SciPy somente opcional para comparação em testes.
- OpenAPI para documentação e contratos.
- Docker para padronização do ambiente.

Avalie também a necessidade de PostgreSQL, SQLAlchemy, Alembic, Redis e processamento assíncrono.

**Não introduza banco de dados, filas, autenticação, cache ou infraestrutura distribuída sem justificar sua necessidade real.**

A robustez deve resultar de decisões técnicas corretas, não da quantidade de ferramentas utilizadas.

---

## 5. Arquitetura — DDD e Clean Architecture

Projete uma arquitetura modular inspirada em **Domain-Driven Design, Clean Architecture e princípios SOLID**, com limites claros entre domínio, aplicação, infraestrutura e interfaces.

Considere uma organização semelhante a:

```text
backend/
├── src/
│   └── pivonauta/
│       ├── domain/
│       │   ├── entities/
│       │   ├── value_objects/
│       │   ├── services/
│       │   ├── exceptions/
│       │   └── repositories/
│       ├── application/
│       │   ├── use_cases/
│       │   ├── commands/
│       │   ├── queries/
│       │   └── dto/
│       ├── infrastructure/
│       │   ├── persistence/
│       │   ├── solvers/
│       │   ├── configuration/
│       │   └── observability/
│       ├── presentation/
│       │   └── api/
│       │       ├── routers/
│       │       ├── schemas/
│       │       ├── dependencies/
│       │       └── exception_handlers/
│       └── main.py
├── tests/
├── pyproject.toml
└── Dockerfile
```

Essa estrutura é apenas uma referência inicial, não uma imposição.

Avalie se uma arquitetura organizada por bounded contexts ou módulos de negócio seria mais adequada do que uma separação puramente horizontal.

### Exigências arquiteturais

- O domínio matemático deve ser independente do FastAPI.
- Regras de negócio não devem depender de schemas HTTP.
- Use cases devem coordenar operações sem incorporar detalhes de infraestrutura.
- Dependências devem apontar para abstrações adequadas.
- DTOs e entidades de domínio devem possuir responsabilidades distintas.
- Exceções de domínio devem ser traduzidas para respostas HTTP consistentes.
- Componentes matemáticos devem ser testáveis isoladamente.
- A arquitetura deve permitir evolução sem reestruturações extensas.

Identifique os possíveis bounded contexts, agregados, entidades, value objects, serviços de domínio, contratos e casos de uso.

Evite abstrações artificiais e excesso de boilerplate.

---

## 6. Engenharia do motor matemático

Este é o componente mais crítico do projeto.

Planeje um **motor matemático confiável, determinístico, auditável e independente da API**.

### 6.1 Simplex tabular

O motor deverá contemplar:

- Maximização e minimização.
- Restrições com operadores ≤, ≥ e =.
- Variáveis com limites e condições de sinal.
- Transformação do modelo para a forma adequada.
- Variáveis de folga, excesso e artificiais.
- Métodos de inicialização, como Simplex de duas fases.
- Construção do tableau inicial.
- Seleção da variável que entra e da variável que sai.
- Teste da razão mínima.
- Operações de pivoteamento.
- Registro de todas as iterações.
- Detecção de solução ótima.
- Detecção de inviabilidade.
- Detecção de problema ilimitado.
- Tratamento de degenerescência.
- Estratégias para evitar ciclagem.
- Identificação de soluções ótimas alternativas.
- Tolerâncias numéricas e estabilidade computacional.

Defina as estruturas de dados necessárias para representar cada etapa do algoritmo.

O frontend deverá conseguir reproduzir integralmente a resolução tabular a partir das respostas da API.

### 6.2 Programação inteira

Projete estratégias separadas para:

1. Solução ótima inteira, implementando **Branch and Bound manualmente em Python puro**, resolvendo cada relaxação com o **Simplex próprio** (sem solver MILP externo).
2. Solução obtida por arredondamento da solução contínua.

A solução arredondada deve ser validada contra todas as restrições e não pode ser apresentada como ótima sem comprovação.

Defina o comportamento da API quando o arredondamento produzir uma solução inviável.

### 6.3 Dualidade

Planeje:

- Construção do problema dual a partir do primal.
- Transformação correta de sinais e restrições.
- Resolução tabular quando aplicável.
- Verificação das relações primal-dual.
- Apresentação dos resultados e interpretação matemática.

Diferencie claramente a resolução do problema dual do algoritmo Dual Simplex.

### 6.4 Soluções múltiplas

Defina como identificar e representar soluções ótimas alternativas, distinguindo múltiplas bases ótimas de múltiplos pontos ótimos distintos.

### 6.5 Representação gráfica

Projete a geração de dados para:

- Semiplanos e fronteiras das restrições.
- Interseções e vértices da região viável.
- Região viável.
- Curvas de nível.
- Solução ótima contínua.
- Pontos inteiros viáveis.
- Solução inteira ótima.
- Solução obtida por arredondamento.

Avalie se o backend deve retornar primitivas geométricas e dados estruturados para renderização no frontend, em vez de gerar imagens estáticas.

Defina também as limitações matemáticas da visualização para modelos com mais de duas variáveis.

### 6.6 Decisão arquitetural aprovada — algoritmos próprios em Python puro

**Decisão obrigatória (04/11/2026):** o Simplex tabular e o Branch and Bound serão implementados manualmente com Python puro. O backend NÃO utilizará `scipy.optimize.linprog`, `scipy.optimize.milp`, PuLP, OR-Tools, NumPy ou qualquer solver matemático de terceiros para resolver problemas, pivotear matrizes, selecionar bases ou calcular a árvore de otimização inteira.

- Construir manualmente a matriz do tableau, a fase I, a fase II, a seleção de pivô, a razão mínima, a eliminação de Gauss-Jordan e a reconstrução da solução.
- Implementar Branch and Bound próprio: relaxação linear por meio do nosso Simplex, criação e exploração de nós, restrições de ramificação, incumbente, limites e podas justificadas.
- Não declarar uma solução como inteira ótima enquanto a árvore não for esgotada, com certificação matemática, respeitados limites de tempo e nós.
- Implementar arredondamento e validação de viabilidade manualmente e reportar explicitamente candidatos inviáveis.
- Admitir apenas a biblioteca padrão Python (`math`, `dataclasses`, `time`, etc.) no motor de domínio. FastAPI e Pydantic ficam restritos às interfaces HTTP/validação externa.
- SciPy pode existir como ferramenta **opcional exclusivamente nos testes de regressão**, nunca como dependência de produção; testes de valores conhecidos devem funcionar sem SciPy.
- Registros completos das iterações do Simplex e dos nós de Branch and Bound serão disponibilizados pela API para a apresentação acadêmica.

### 6.7 Validação matemática

Inclua uma estratégia de verificação cruzada com bibliotecas matemáticas consolidadas, sem substituir a implementação tabular exigida pela disciplina.

Planeje testes com problemas conhecidos, incluindo casos degenerados, inviáveis, ilimitados e com soluções alternativas.

---

## 7. Design e contratos da API

Defina uma API REST profissional, versionada e documentada.

Para cada recurso, especifique:

- Método HTTP.
- Endpoint.
- Responsabilidade.
- Request schema.
- Response schema.
- Códigos HTTP.
- Erros possíveis.
- Regras de validação.
- Caso de uso associado.
- Componente do frontend consumidor.

Considere recursos relacionados a:

- Modelos de Programação Linear.
- Validação de modelos.
- Execução do Simplex.
- Histórico de iterações e tableaux.
- Soluções inteiras.
- Problemas duais.
- Análise de soluções múltiplas.
- Visualizações geométricas.
- Relatórios.
- Persistência e histórico de modelos, caso necessários.

Apresente exemplos realistas de JSON para as operações principais.

Defina padrões consistentes de nomenclatura, serialização, versionamento e compatibilidade.

Avalie processamento síncrono versus assíncrono com base na complexidade e no custo computacional das operações.

---

## 8. Segurança, validação e confiabilidade

Mesmo sendo um projeto acadêmico, a API deverá seguir práticas profissionais de segurança.

Planeje:

- Validação rigorosa de payloads.
- Restrições de tamanho e complexidade dos modelos.
- Limites para quantidade de variáveis e restrições.
- Limites de iterações e tempo de execução.
- Proteção contra consumo excessivo de CPU e memória.
- Configuração segura de CORS.
- Gestão de variáveis de ambiente.
- Tratamento seguro de exceções.
- Prevenção de vazamento de detalhes internos.
- Sanitização e validação de entradas.
- Logging estruturado.
- Identificadores de correlação por requisição.
- Health checks e readiness checks.
- Estratégia de rate limiting, se necessária.
- Gestão segura de dependências.

Avalie autenticação e autorização somente após investigar os fluxos existentes.

### Padronização de erros

Proponha um contrato consistente de erros, preferencialmente baseado em RFC 9457 (Problem Details), com:

- Código identificável.
- Mensagem compreensível.
- Detalhes de validação.
- Identificador da requisição.
- Status HTTP adequado.

Diferencie erros de validação, erros de domínio matemático, falhas de infraestrutura e erros inesperados.

---

## 9. Qualidade, testes e observabilidade

Elabore uma estratégia de testes que contemple:

- Testes unitários do domínio.
- Testes de use cases.
- Testes de integração da API.
- Testes de contrato.
- Testes de regressão matemática.
- Testes parametrizados.
- Testes baseados em propriedades, quando apropriados.
- Testes de cenários extremos.
- Testes de desempenho e limites computacionais.

Proponha uma matriz de cenários matemáticos com entradas, saídas esperadas e critérios de aprovação.

Defina critérios objetivos para considerar o motor Simplex matematicamente confiável.

Inclua também recomendações de CI, cobertura de testes, análise estática, documentação e observabilidade.

---

## 10. Integração com o frontend

O backend não deve ser planejado isoladamente.

Para cada fluxo existente, determine:

1. Quais dados o frontend fornece.
2. Qual endpoint deverá receber esses dados.
3. Quais validações serão executadas.
4. Qual processamento matemático será realizado.
5. Qual formato de resposta será retornado.
6. Como o frontend utilizará os resultados.
7. Como erros, carregamento e estados vazios deverão ser tratados.

Proponha uma estratégia para geração ou compartilhamento de tipos TypeScript a partir dos contratos OpenAPI, reduzindo inconsistências entre frontend e backend.

Preserve os componentes e fluxos existentes sempre que possível.

---

## 11. Planejamento de implementação

Divida o desenvolvimento em fases incrementais, com dependências explícitas.

Considere a seguinte sequência inicial, ajustando-a conforme a investigação:

**Fase 1 — Fundação arquitetural**

Estrutura do backend, configuração, injeção de dependências, schemas fundamentais, tratamento de erros, observabilidade, testes e integração inicial.

**Fase 2 — Domínio matemático**

Modelagem de problemas lineares, validações, transformações e estruturas matemáticas.

**Fase 3 — Simplex tabular**

Implementação do algoritmo, tableaux, pivoteamento, iterações e tratamento dos estados matemáticos.

**Fase 4 — Branch and Bound próprio e recursos avançados**

Implementação **manual** do Branch and Bound reutilizando o motor Simplex, solução inteira ótima com prova de poda, arredondamento, dualidade e soluções múltiplas.

**Fase 5 — Visualização e relatórios**

Dados geométricos, curvas de nível, regiões viáveis, soluções inteiras e geração de relatórios.

**Fase 6 — Integração e estabilização**

Integração frontend/backend, testes ponta a ponta, revisão de segurança, documentação e preparação da apresentação.

Para cada fase, apresente:

- Objetivo.
- Escopo.
- Tarefas técnicas.
- Arquivos e módulos previstos.
- Dependências.
- Complexidade estimada.
- Riscos.
- Critérios de aceite.
- Testes necessários.
- Entregáveis verificáveis.

Considere o prazo final de 04/12/2026 e priorize a entrega de um sistema funcional e demonstrável antes de melhorias secundárias.

---

## 12. Planejamento do primeiro Pull Request

Após apresentar o plano geral, detalhe o escopo recomendado para o **PR #1 — Backend Foundation**.

O primeiro PR deverá entregar uma fundação utilizável, não apenas diretórios e interfaces vazias.

Descreva:

- Estrutura inicial de arquivos.
- Dependências e configurações.
- Bootstrap da aplicação.
- Convenções de arquitetura.
- Schemas e contratos fundamentais.
- Tratamento global de erros.
- Primeiros endpoints funcionais.
- Testes automatizados.
- Docker e execução local.
- Integração mínima com o frontend.
- Critérios de aceite.
- Comandos para executar, testar e validar.

Defina claramente o que ficará fora do PR #1 e será implementado nas próximas fases.

A implementação foi autorizada em 04/11/2026; criar PRs incrementais sem fazer merge automático.

---

## 13. Formato obrigatório da resposta

Organize sua entrega nas seguintes seções:

1. **Executive Summary:** diagnóstico do projeto e estratégia recomendada.
2. **Repository Audit:** análise técnica do código existente, com referências aos arquivos.
3. **Feature Mapping:** matriz de rastreabilidade frontend/backend.
4. **Architecture Decision Records:** decisões arquiteturais, alternativas e justificativas.
5. **Domain Design:** entidades, value objects, serviços, casos de uso e limites dos módulos.
6. **Architecture Blueprint:** árvore de diretórios e diagramas Mermaid das dependências e fluxos.
7. **Mathematical Engine Design:** especificação detalhada do motor Simplex e funcionalidades avançadas.
8. **API Contract:** endpoints, schemas, exemplos JSON e tratamento de erros.
9. **Security & Reliability:** validação, segurança, limites e observabilidade.
10. **Testing Strategy:** testes e critérios de correção matemática.
11. **Implementation Roadmap:** fases, prioridades, dependências e critérios de aceite.
12. **PR #1 Specification:** escopo detalhado do primeiro Pull Request.
13. **Risks & Open Questions:** riscos, ambiguidades e decisões pendentes.

Sempre que possível, apresente comparações técnicas e justifique suas escolhas.

---

## 14. Restrições e critérios de qualidade

- Implementação autorizada após a revisão do planejamento em 04/11/2026.
- Implemente somente em branch de trabalho, com testes e revisão via PR.
- Branches e PRs estão autorizados; não faça merge na branch principal sem autorização.
- Não presuma funcionalidades sem inspecionar o frontend.
- Não proponha endpoints desconectados de necessidades reais.
- Não confunda a resolução Simplex contínua com otimização inteira.
- Não trate arredondamento como garantia de solução inteira ótima.
- Não confunda problema dual com Dual Simplex.
- Não utilize solvers de terceiros, NumPy ou SciPy para resolver o Simplex nem o Branch and Bound em produção; ambas as implementações são autorais em Python puro.
- Não introduza complexidade arquitetural sem justificativa.
- Não comprometa o prazo acadêmico em busca de uma arquitetura excessivamente sofisticada.
- Não apresente pseudocódigo como se fosse implementação concluída.
- Não omita limitações, hipóteses ou decisões pendentes.

**Critério principal de sucesso:** entregar um plano suficientemente detalhado para que outro engenheiro consiga implementar o backend de forma incremental, sem precisar redefinir a arquitetura, os contratos principais ou as regras matemáticas.

A implementação foi **explicitamente autorizada em 04/11/2026**. Comece por uma fundação executável, avance para o motor matemático próprio e abra um PR revisável; não faça merge automático.
---

## Registro de evolução — 04/11/2026 (fase de análises matemáticas)

- O Simplex tabular de duas fases e o Branch and Bound permanecem implementados
  manualmente em Python puro, sem chamadas a solvers externos em execução.
- O frontend foi conectado à API em uma etapa anterior.
- A fase atual introduz `duality.py` (modelo dual e resolução tabular),
  `alternatives.py` (certificação de soluções ótimas alternativas) e
  `geometry.py` (região viável calculada para duas variáveis).
- Endpoints previstos/implementados: `/api/v1/solves/dual`,
  `/api/v1/solves/alternatives`, `/api/v1/geometry`.
- Casos especiais que não sejam matematicamente certificados não devem
  aparecer no frontend como se fossem resultados conclusivos.
- Próximos incrementos: relatório PDF completo e testes E2E; auditoria de
  limites computacionais e robustez numérica antes da entrega final.


## Registro de evolução — PR #4: modelagem e confiabilidade (04/11/2026)

- Modelo canônico versionado de frontend (`schema_version: 1`) com `variables[]`, `objective[]` e `constraints[]`. Domínio, limites inferiores/superiores e variáveis livres são preservados no payload FastAPI.
- Editor visual n-dimensional (1–10 variáveis; 0–30 restrições), campos numéricos que bloqueiam revisão quando vazios/inválidos e validação estrutural pela API.
- Parser algébrico de expressões lineares próprias, sem `eval()`, com pré-visualização antes da aplicação.
- JSON versionado, importação de arquivo e suporte a modelos canônicos, formato API e exemplos legados; transação não altera o modelo até a confirmação.
- IndexedDB para rascunhos, biblioteca de modelos locais (salvar/duplicar/excluir) e histórico de execuções para futura interface de inspeção.
- Início em um comando no Windows/macOS/Linux com `scripts/dev.py`, healthcheck FastAPI e Vite. Sem solver matemático externo.
- Gráfico bidimensional explicitamente indisponível para modelos com número de variáveis diferente de dois.
- Fora do PR #4: Inspector tipado e console de eventos do solver (PR #5), curvas de nível e árvore visual BnB (PR #6), PDF e E2E/browser (PRs #7–8).

A feature branch não deve ser mesclada antes da aprovação dos testes de frontend/backend e da revisão do fluxo principal com um modelo misto de três variáveis.


## Registro de evolução — PR #5 (04/11/2026)

A integração pedagógica passa a ter Inspector contextual para variáveis, restrições, células de tableau e nós do Branch and Bound; console de eventos estruturados construídos a partir de resultados reais; uma única apresentação tabular reutilizada no primal e no dual; e endpoint de forma padrão que utiliza a função `standardize` do motor. Foram adicionados dados de operações elementares e custos reduzidos aos snapshots sem romper o contrato antigo.

Os eventos do console não são transmitidos em tempo real: são derivados da resposta HTTP e reconstruídos do histórico local quando disponível. A arquitetura e as limitações estão descritas em `docs/REVISAO_ARQUITETURA_PR5.md`. A fase seguinte continua responsável por curvas de nível e árvore gráfica; o relatório PDF e os testes E2E ficam nas etapas seguintes.


## Registro de evolução — PR #6 (04/11/2026)

Foram implementadas sobreposições geométricas calculadas no backend (`level_lines`, `integer_lattice` e `optimal_face`) e visualizações interativas no frontend. O painel de geometria distingue a amostragem da malha, o incumbente não certificado e a aresta ótima condicionada à prova de múltiplas soluções.

A árvore visual utiliza relações reais entre os nós do Branch and Bound e inclui a inspeção de tableaux da relaxação de cada nó por reconstrução de decisões estruturadas. Os testes cobrem níveis da função objetivo, viabilidade de pontos inteiros, reconstrução de ramificações e rotas de API.

Pendências para os próximos PRs: relatório PDF completo, testes E2E, robustez numérica em escala e revisão do limite de restrições para visualização de tableaux de nós profundos. A revisão arquitetural está em `docs/REVISAO_ARQUITETURA_PR6.md`.


## Registro de evolução — PR #7 (04/11/2026)

A etapa de geração de relatórios foi implementada no backend com coleta independente de resultados matemáticos, composição de páginas em ReportLab e desenhos vetoriais de geometria e da árvore Branch and Bound. Foi criado `POST /api/v1/reports/pdf`, com seleção de capítulos, limite de tableaux e modo inteiro parametrizável.

No frontend, a tela de relatório oferece seleção de seções, pré-visualização, download e estados de erro. O PDF contém status e avisos explícitos para resultados não certificados, trilhas amostradas e análises não aplicáveis. A revisão de arquitetura encontra-se em `docs/REVISAO_ARQUITETURA_PR7.md`.

Próxima etapa: PR #8 — testes E2E, robustez, deploy, revisão visual de PDF em navegador, melhoria de segurança e preparação do seminário.
