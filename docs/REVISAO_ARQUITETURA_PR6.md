# Revisão de arquitetura — PR #6

## Escopo e decisões

O PR #6 completa a primeira versão das visualizações matemáticas bidimensionais e da árvore interativa de Branch and Bound. Não altera as regras de otimização do Simplex nem substitui os solucionadores próprios em Python puro.

### Geometria

A implementação preserva a divisão de responsabilidades:

- `geometry.py`: monta a geometria da região viável e os segmentos das restrições, a partir do modelo do domínio.
- `geometry_overlays.py`: deriva as curvas de nível, os segmentos de nível ótimo e uma amostra de pontos inteiros viáveis. Os pontos da grade são testados com `is_feasible`; nenhum resultado ótimo é inventado.
- `OptimizationPlot.jsx`: projeta apenas os dados retornados pela API e as soluções do Branch and Bound; alterna camadas e apresenta coordenadas selecionáveis.
- `plotGeometry.js`: transforma vetores de soluções em pontos e só permite destacar uma aresta ótima quando a análise de ótimos múltiplos a certifica.

### Semântica da malha e de certificados

A malha de inteiros representa duas variáveis inteiras. Se as duas variáveis do modelo são contínuas, o frontend sinaliza explicitamente que a grade corresponde à versão hipotética com ambas inteiras — o mesmo cenário utilizado pela opção `force_all_integer` no Branch and Bound. Para modelos mistos, a malha inteira não pretende representar a geometria da variável contínua.

Há limites explícitos de amostragem (`max_integer_points` entre 1 e 500). Se a extensão da malha exceder o orçamento, os pontos são amostrados e a interface avisa que existem pontos não exibidos. Uma malha amostrada não é usada para certificar solução inteira. O único indicador de ótimo inteiro é o status `optimal` do Branch and Bound. Se a busca parar por limite, o incumbente é identificado como não certificado.

As curvas de nível são isolinhas da função objetivo `c·x = k` cortadas na janela de visualização. O segmento de ótimos múltiplos só é destacado quando o serviço de alternativas devolve `multiple` e `certified=true`. Não há afirmação de ótimos alternativos com base apenas em custo reduzido zero.

### Árvore de Branch and Bound

- `branch_bound.py` informa `branch_decision` em cada nó, preservando os campos já existentes na API.
- `branchTree.js` desenha a topologia com `parent_id` e recompõe o caminho de restrições do nó por decisões estruturadas; não interpreta strings de interface para descobrir o caminho matemático.
- `BranchTree.jsx` apresenta os nós explorados, seus estados, zoom, navegação por etapas e acesso ao Inspector. O botão de tableau monta a relaxação do nó e solicita `POST /api/v1/solves`, reutilizando o Simplex próprio e o componente `TableauViewer`.

A árvore não representa como explorados nós que ainda estão apenas na fila quando o algoritmo encerra por limite de tempo/nós. Isso evita confundir ramos ainda pendentes com provas de poda. Para problemas grandes, a árvore pode exigir rolagem horizontal; os controles de zoom minimizam esse inconveniente.

## Compatibilidade

`POST /api/v1/geometry` aceita `options` opcionais. Chamadas existentes sem `options` continuam válidas. O resultado conserva todos os campos anteriores e agrega `level_lines`, `optimal_face` e `integer_lattice` sem alterar o significado de `polygon` em regiões ilimitadas.

Os nós de Branch and Bound mantêm `parent_id`, `children`, `branch_constraint`, `relaxation_status`, `relaxation_variables` e agregam `branch_decision`. O novo campo não exige que o frontend reconstrua a sequência de decisões com heurísticas.

## Riscos e dívida técnica

1. A geometria só representa exatamente duas variáveis; problemas de dimensão maior são resolvíveis, mas não podem ser visualizados fielmente no plano.
2. A aritmética interna segue com `float` e tolerâncias. Degenerescência severa, escalonamento muito ruim e limites extremos pedem testes adicionais no PR #8.
3. O tableau de um nó é recalculado sob demanda. Em árvores profundas, o limite HTTP de 30 restrições pode impedir essa visualização; o resultado do nó e a árvore continuam disponíveis. O PR #8 poderá introduzir um contrato especializado para reinspeção de caminhos maiores.
4. A malha de pontos inteiros é uma visualização amostrada; não substitui Branch and Bound nem fornece prova de otimalidade.
5. O console continua registrando o resultado após a resposta HTTP, sem streaming real dos nós.
6. Exportação PDF e testes de navegador serão tratados, respectivamente, nos PRs #7 e #8.

## Critérios de aceite

- Curvas de nível respeitam a equação do objetivo e são extraídas de dados calculados.
- Pontos inteiros exibidos pertencem à região viável, e amostragens são identificadas.
- O ótimo inteiro usa o resultado real do BnB e diferencia certificado de incumbente.
- Arestas de múltiplos ótimos só aparecem com certificado de multiplicidade.
- Árvore e links entre nós derivam de `parent_id`, e as condições de poda/inviabilidade são preservadas.
- Selecionar um nó permite reproduzir a relaxação local com o Simplex próprio.
- Testes de unidade e integração, build do frontend e CI devem passar.
