# PR #13 — Correções da auditoria de produção (21/11/2026)

## Referência

Auditoria funcional do ambiente `https://pivonauta.celodev.com.br/`, executada em Chromium no [GitHub Actions, run 44957844458](https://github.com/marcelomatheus/pesquisa-operacional/actions/runs/44957844458).

A auditoria apontou **41 verificações, 37 aprovadas e quatro defeitos reproduzidos**. As alterações deste PR são destinadas a resolver esses defeitos e padronizar a apresentação dos resultados para o seminário. O motor matemático e os contratos de cálculo existentes foram preservados.

## Defeitos e correções

| Prioridade | Problema da produção | Causa comprovada | Correção do PR | Verificação |
|---|---|---|---|---|
| P0 | Formulário do editor visual comprimido a 42 px em um cartão de 655,75 px | `.equation-node` declarava três colunas, mas havia apenas dois filhos | Grid de duas colunas, `26px minmax(0,1fr)` no desktop e `20px minmax(0,1fr)` no mobile | Teste E2E de largura útil em 1366, 1024, 768, 390 e 320 px |
| P1 | Primal da tela dual exibia `undefined` no lugar de inequações | Conversão invertida de `le`/`ge`/`eq` | Encaminhamento de `constraint.operator` ao componente matemático já responsável pela apresentação | Teste E2E com `≤`, `≥`, `=` e ausência de `undefined` |
| P1 | Após salvar e recarregar imediatamente, editor retornava ao modelo padrão | Persistência automática do rascunho tinha debounce de 650 ms e salvamento na Biblioteca não aguardava `writeDraft` | Escrita explícita e aguardada do rascunho ao salvar, importar ou trocar modelo; salvamento confirmado apenas após o IndexedDB concluir | Testes E2E de importação sem espera, salvar → recarregar, persistência Biblioteca |
| P2 | Botão `Revisar modelo` ultrapassava o viewport móvel em 45 px | Header e ações em uma linha sem espaço suficiente | Header reorganizado em duas linhas, campo de nome flexível e botões de 44 px de altura | Teste E2E em 320, 375 e 390 px, incluindo posição e dimensões reais |

## Acabamento acadêmico

- As mensagens de Simplex, Branch and Bound, dualidade e ótimos alternativos são traduzidas na **camada de apresentação**; os retornos originais da API permanecem intactos para auditoria técnica.
- O console passa a mostrar estados localizados e número de pivoteamentos com singular/plural correto.
- Os cartões da Biblioteca e do resumo também utilizam singular/plural apropriados.
- O link de exportação passa a ser **“Relatório acadêmico em PDF”**, em vez de “Relatório textual”.
- O compositor PDF traduz fases `phase_1`/`phase_2`, eventos, regiões como `polygon`, domínios, estados dos nós e mensagens conhecidas do solucionador.
- O título e os rótulos do documento foram revisados quanto a acentuação e clareza.
- A versão da API e do pacote backend passa de `0.1.0` para `1.0.0`, alinhada à apresentação da v1. A versão do pacote do frontend é independente da versão da API.

## Estratégia de validação

1. Executar `npm test` e `npm run build`.
2. Executar `pytest -q` e `ruff check` no backend.
3. Executar a suíte Playwright em Chromium desktop e mobile, incluindo os novos testes de dimensões, operadores e recarga imediata.
4. Verificar estruturalmente PDFs reais e extrair seu texto com `pypdf`, confirmando ausência de `phase_2`, `polygon` e mensagens conhecidas em inglês.
5. Validar a imagem de produção do frontend/API em containers com smoke de Wyndor e download de PDF.

A CI comprova esses cenários, mas **não substitui a verificação do domínio publicado**. Este PR não reinicia a VPS nem executa deploy.

## Deploy e confirmação no domínio real

Após a revisão e o merge:

```bash
cd /opt/pivonauta
git pull --ff-only
bash scripts/deploy_manual.sh
PIVONAUTA_URL=https://pivonauta.celodev.com.br python3 scripts/smoke_production.py
```

Como o PR modifica **frontend e backend**, é necessário reconstruir ambos os serviços. A atualização isolada do `web` não incluiria as correções de apresentação e versão do PDF no backend.

A confirmação de produção deve repetir os quatro casos críticos da auditoria em sessões novas do navegador. Não há manipulação de dados de terceiros nem necessidade de alteração na rede Traefik/Cloudflare.

## Limitações não resolvidas pelo PR

- Mensagens técnicas desconhecidas são preservadas literalmente para não distorcer a informação matemática.
- O salvamento automático de **digitação isolada** ainda usa debounce; em um fechamento abrupto antes da gravação, alterações não confirmadas podem não ser persistidas. Importar, trocar e salvar modelos são ações confirmadas e agora aguardam a escrita.
- O armazenamento permanece local no IndexedDB; não há sincronização entre aparelhos.
- O deploy público, controle de domínio e estabilidade operacional da VPS dependem da execução manual de seu administrador.
