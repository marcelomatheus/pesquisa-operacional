# PivôNauta 2.1 — protótipo navegável

Protótipo acadêmico de uma aplicação de Pesquisa Operacional para modelagem e demonstração do método Simplex. A experiência cobre editor algébrico, prova tabular, região de viabilidade, solução inteira, Branch and Bound, modelo dual, casos especiais e relatório.

## Novidade da versão 2.1

- Landing page pública com apresentação do sistema, jornada de análise e estrutura da equipe.
- Visualização animada da região viável, curvas de nível, ponto ótimo e fluxo do tableau.
- Entrada separada para o laboratório, preservando o shell fixo da aplicação.
- Animações infinitas com alternativa estática para usuários que preferem movimento reduzido.

## O que mudou na versão 2.0

- Navegação única e fixa, sem barras duplicadas.
- Console matemático fixo no rodapé da área de trabalho.
- Inspetor funcional com seções recolhíveis e controles editáveis.
- Nova direção visual baseada em uma bancada científica, com IBM Plex e superfícies contínuas.
- Tela inicial ajustada integralmente ao viewport em desktop.
- Troca imediata entre rotas, sempre iniciando no topo da nova página.
- Criação de novo modelo, importação JSON e escolha de domínio funcionais.
- Transformação para forma padrão, ampliação do gráfico e cópia do link funcionais.

## Como executar

É necessário ter o [Node.js](https://nodejs.org/) 20 ou superior instalado.

### Opção rápida

- Windows: execute `iniciar.bat`.
- macOS/Linux: execute `./iniciar.sh`.

Os scripts instalam as dependências quando necessário e abrem o servidor local em `http://localhost:4173`.

### Pelo terminal

```bash
npm install
npm run dev
```

Depois, acesse `http://localhost:4173`.

## Comandos

```bash
npm run dev      # ambiente local
npm run build    # gera versão de produção em dist/
npm run preview  # visualiza a versão de produção
```

## Jornada sugerida

1. Abra **Biblioteca** e carregue um exemplo.
2. Edite a função objetivo e as restrições.
3. Revise e execute o modelo.
4. Reproduza o Simplex passo a passo.
5. Alterne as camadas do gráfico.
6. Compare arredondamento e Branch and Bound.
7. Explore o dual e os diagnósticos especiais.
8. Monte e exporte o relatório-resumo.

> Este pacote é um protótipo de interface: os resultados matemáticos apresentados são cenários demonstrativos pré-configurados para a validação da experiência e da arquitetura do sistema.
