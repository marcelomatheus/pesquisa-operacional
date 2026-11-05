# Validação e checklist de entrega — PivôNauta v1

**Data:** 04/11/2026  
**Base funcional:** `main` após integração dos PRs #1–#7  
**Branch de estabilização:** `test/v1-end-to-end-hardening`  
**Pull Request:** [#8](https://github.com/marcelomatheus/pesquisa-operacional/pull/8)

## Critério de conclusão

A v1 deve permitir **modelar → validar → resolver → inspecionar → visualizar → exportar** utilizando resultados calculados pelo backend. Não há compromisso de produzir prova matemática em situações nas quais os limites de execução impeçam certificação.

## Evidências automatizadas

| Frente | Cenários cobertos | Evidência |
|---|---|---|
| Frontend | Testes Node e build Vite | Workflow `PivôNauta CI`, aprovado |
| Backend | Testes pytest de Simplex, BnB, dualidade, ótimos alternativos, geometria, API, PDF e limites HTTP | Workflow `PivôNauta CI`, aprovado |
| Navegador | 14 casos em Chromium desktop e mobile: importação JSON, Simplex, tableau, geometria, dual, alternativas, BnB, PDF, biblioteca, editor algébrico, falha da API e navegação mobile | [E2E aprovado — run 41911385333](https://github.com/marcelomatheus/pesquisa-operacional/actions/runs/41911385333) |
| PDF estrutural | Leitura de PDFs em `pypdf`, marcadores de capítulos, conteúdo e estados não certificados | `backend/tests/test_report_pdf.py` |
| PDF renderizado | Rasterização, texto dentro das bordas e amostras de Wyndor, radioterapia, problema grande e inviável | [PDF preflight — run 41911639098](https://github.com/marcelomatheus/pesquisa-operacional/actions/runs/41911639098) |
| API resiliente | Rejeição de corpos HTTP acima de 100 KB, inclusive sem `Content-Length`; CORS com origens declaradas | `backend/tests/test_hardening.py` |
| Publicação unificada | HTML estático, API, Simplex Wyndor `Z=36` e PDF pelo Nginx, com containers Docker Compose | Workflow `PivôNauta Browser E2E`, job `production_smoke` |

## PDF — conferência dos cenários

| Modelo | Total de páginas da amostra | Verificação |
|---|---:|---|
| Wyndor | 8 | Texto e gráfico vetorial renderizados; Z=36 |
| Radioterapia | 9 | Simplex, programação inteira, gráfico e dualidade |
| Modelo com 10 variáveis e 30 restrições | 64 | Páginas extensas, sem texto fora dos limites |
| Modelo inviável | 2 | Ausência de ótimo inventado |

A pré-verificação automatizada usa PyMuPDF para ler, localizar e rasterizar páginas. A conferência humana de amostras renderizadas inspecionou a formulação, os tableaux e a página de geometria Wyndor. O relatório de maior dimensão é legível, porém longo; para a apresentação recomenda-se selecionar poucos tableaux.

## Separação de responsabilidades

- `domain.py`, `simplex.py`, `branch_bound.py`, `duality.py` e módulos geométricos realizam cálculos matemáticos em Python puro.
- `main.py` contém a API, validação, respostas de erro, CORS e tamanho de corpo.
- `report_data.py` orquestra cálculos; `report_pdf.py` e `report_graphics.py` compõem e desenham o PDF.
- `solverApi.js`, `model.js` e serviços de persistência fazem a ponte com o frontend, sem cálculos matemáticos simulados.
- O Docker Compose expõe um único ponto HTTP para frontend e API; o backend não tem porta publicada diretamente no host.

## Riscos e limitações não bloqueantes

1. **Deploy público:** foram testados containers integrados em runner CI, mas nenhuma URL pública do frontend/API foi certificada. A implantação pública precisa de HTTPS, DNS e observabilidade próprios.
2. **Responsividade:** a navegação foi exercitada em Chromium em dois viewports; uma auditoria manual em dispositivos físicos e outros navegadores ainda é recomendada.
3. **Escala numérica:** testes de casos especiais existem, mas não representam prova de robustez universal contra todos os problemas de ponto flutuante ou degenerescência extrema.
4. **PDF extenso:** modelos grandes com vários tableaux produzem documentos longos. A seleção de capítulos e o limite de tableaux devem ser usados conscientemente.
5. **Persistência local:** dados no IndexedDB não são sincronizados com outras máquinas e podem ser perdidos na limpeza do navegador.
6. **Sem streaming:** os eventos do console são derivados das respostas após o término dos cálculos.
7. **Legado do protótipo:** existem arquivos demonstrativos antigos no repositório, mas as rotas matemáticas integradas utilizam resultados reais da API.

## Checklist de entrega acadêmica

- [x] Simplex e Branch and Bound manuais em Python puro.
- [x] Editor visual, algébrico e importação/exportação JSON.
- [x] Biblioteca e recuperação de modelos locais.
- [x] Inspector contextual, console e tableaux auditáveis.
- [x] Análises geométricas, curvas de nível, pontos inteiros, dual e ótimos múltiplos.
- [x] Relatório PDF com capítulos selecionáveis e avisos de certificação.
- [x] Testes automatizados frontend/backend.
- [x] Browser E2E em Chromium desktop e mobile.
- [x] Renderização/inspeção básica de relatórios PDF.
- [x] Execução integrada de frontend/API em containers.
- [ ] Aprovação/revisão e merge do PR #8.
- [ ] Publicação e verificação em uma URL externa caso a demonstração exija acesso público.
- [ ] Teste de operação no computador que será usado no seminário.
- [ ] Revisão dos slides, roteiro e materiais conforme prazo acadêmico de 04/12/2026.

## Demonstração recomendada

1. Wyndor: importar, editar, validar e resolver (`x1=2`, `x2=6`, `Z=36`).
2. Abrir tableau, selecionar pivô e inspecionar operações de linha.
3. Abrir gráfico, curvas de nível e solução inteira.
4. Visualizar Branch and Bound, dualidade e diagnóstico de ótimos alternativos.
5. Radioterapia: mostrar contínuo `5,25` e inteiro `5,30`.
6. Montar um PDF curto com os capítulos essenciais e baixar.
7. Atualizar a página e comprovar recuperação do modelo salvo.

**Regra de certificação:** nunca apresentar como ótimo um candidato inteiro calculado sob limite sem prova de conclusão da busca.
