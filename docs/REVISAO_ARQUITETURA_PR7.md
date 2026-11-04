# Revisão de arquitetura — PR #7: relatórios técnicos em PDF

## Objetivo

Implementar relatórios acadêmicos reprodutíveis para a v1 do PivôNauta, sem substituir o Simplex, o Branch and Bound ou as análises matemáticas existentes por bibliotecas de otimização.

O relatório é gerado na API em Python. O navegador apenas escolhe seções, solicita o arquivo e oferece visualização ou download. As soluções não são fornecidas pelo cliente como fatos confiáveis: a API refaz os cálculos a partir do modelo recebido e aplica os mesmos limites de execução dos algoritmos existentes.

## Responsabilidades

| Módulo | Responsabilidade |
|---|---|
| `backend/src/pivonauta/report_data.py` | Orquestrar os serviços matemáticos para as seções escolhidas e emitir notas de certificação |
| `backend/src/pivonauta/report_pdf.py` | Apresentar os resultados e metadados em páginas, textos e tabelas com ReportLab |
| `backend/src/pivonauta/report_graphics.py` | Desenhar o plano viável e o diagrama de ramificações como elementos vetoriais |
| `backend/src/pivonauta/schemas.py` | Validar seções, limites de tableaux/nós e escolha do cenário inteiro |
| `backend/src/pivonauta/main.py` | Expor `POST /api/v1/reports/pdf` como `application/pdf` com download e cache desativado |
| `src/services/reportOptions.js` | Definir e validar as opções apresentadas ao usuário |
| `src/services/solverApi.js` | Enviar requisição e validar mídia, conteúdo e status HTTP |
| `src/screens/ReportBuilder.jsx` | Seleção de capítulos, parâmetros, mensagens, visualização e download |

ReportLab é utilizado exclusivamente para compor o PDF; não participa de cálculo matemático. Os solucionadores de Simplex e Branch and Bound permanecem implementados em Python puro.

## Contrato HTTP

`POST /api/v1/reports/pdf`

Entrada:

```json
{
  "model": {
    "name": "Wyndor",
    "sense": "max",
    "variables": [
      { "id": "x1", "domain": "continuous" },
      { "id": "x2", "domain": "continuous" }
    ],
    "objective": [3, 5],
    "constraints": [
      { "id": "r1", "coefficients": [1, 0], "operator": "le", "rhs": 4 },
      { "id": "r2", "coefficients": [0, 2], "operator": "le", "rhs": 12 },
      { "id": "r3", "coefficients": [3, 2], "operator": "le", "rhs": 18 }
    ]
  },
  "options": {
    "sections": ["model", "simplex", "integer", "geometry", "dual", "alternatives"],
    "max_tableaux": 30,
    "max_nodes": 200,
    "integer_mode": "all_integer"
  }
}
```

Saída: bytes de PDF, `Content-Type: application/pdf`, `Content-Disposition: attachment` e `Cache-Control: no-store`.

Seções aceitas: `model`, `simplex`, `integer`, `geometry`, `dual` e `alternatives`. O resumo executivo é sempre gerado. Opções inválidas retornam HTTP 422 usando o padrão de erro já existente.

## Fidelidade matemática

- O relatório indica status `optimal` somente quando o algoritmo retorna essa certificação.
- Um incumbente inteiro após `node_limit` ou `time_limit` não é denominado solução ótima.
- Candidatos arredondados são identificados pela sua viabilidade e não constituem prova de otimalidade.
- O dual mostra os resultados do próprio solucionador, gap e verificação de complementaridade.
- Arestas de ótimos múltiplos são destacadas somente quando o diagnóstico retorna multiplicidade certificada.
- Para modelos com dimensão diferente de 2, a seção geométrica informa não aplicabilidade em vez de gerar uma figura enganosa.
- Polígonos de regiões ilimitadas representam apenas o recorte da janela e são explicitamente rotulados.
- Se houver muitos tableaux, o PDF indica a amostragem e preserva os extremos quando o limite permitir.
- Diagramas de árvore mostram no máximo 24 nós, com aviso de truncamento; a tabela posterior lista todos os nós explorados na execução.
- A malha de inteiros é visualização, não prova de otimalidade.

## Design e exportação

O relatório possui cabeçalho, rodapé, número de página, título, resumo, formulação e tabelas com quebra de página. As matrizes de tableaux extensas são divididas em conjuntos de colunas, repetindo a coluna de RHS. Gráficos e árvores são desenhados vetorialmente para manter a legibilidade no PDF.

O frontend oferece pré-visualização em `iframe` por URL local de objeto, além de arquivo para download. As URLs são revogadas quando o modelo ou as opções mudam, evitando reutilização de um relatório obsoleto. O nome do arquivo é normalizado antes do download.

## Limites e riscos conhecidos

1. A geração é síncrona; cada análise refaz cálculos e pode consumir tempo de CPU. Limites de pivôs, nós e tableaux reduzem o risco, mas controle de concorrência e limitação de requisições ainda precisam ser revisados no PR #8.
2. O histórico tabular inclui custos reduzidos e pivôs, mas a quantidade de tableaux exportados é controlada pelo usuário entre 1 e 100. Quando não há espaço, a amostragem é informada e não apresentada como trilha completa.
3. Gráficos bidimensionais não substituem visualização de modelos com três ou mais variáveis.
4. O documento gerado no servidor pode diferir de uma execução anterior do frontend se limites numéricos ou tempos causarem interrupção; o próprio relatório registra o status da nova execução.
5. A visualização do PDF embutida depende do suporte do navegador a PDF. O download permanece disponível.
6. Testes de integração HTTP e leitura de texto foram adicionados, mas inspeção visual automatizada em navegador e validação do deploy ficam para o PR #8.

## Definição de pronto

- PDF legível e válido, contendo as seções selecionadas e nenhum capítulo matemático não solicitado.
- Testes para Wyndor, programação inteira, modelo inviável e ausência de geometria em 3D.
- O motor matemático não depende de ReportLab; a dependência está confinada à camada de composição.
- Estados não certificados descritos explicitamente.
- Frontend compila e transmite opções correspondentes ao contrato da API.
- Testes do backend e frontend aprovados na CI.
