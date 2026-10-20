# Fechamento da experiência integrada — 20/10/2026

Escopo: concluir os fluxos existentes antes de expandir funcionalidades. Nenhum endpoint de negócio, biblioteca de UI, migração ou automação de pagamento foi acrescentado.

## Problemas comprovados e correções

- A prévia utilizava backend de setembro, anterior aos contratos financeiros da interface. API e banco financeiro pertencem a projetos Neon diferentes; clonar apenas a Function não isola Auth/Data API. Criados ramos exclusivos para a prévia nos dois projetos, com validação dos destinos na inicialização e na publicação.
- A sessão da prévia dividia chaves de localStorage com produção. O build agora deriva um namespace do backend de homologação. Login e logout da prévia não removem a sessão de produção.
- O plugin Vite escrevia arquivos legados em `dist` mesmo com outro `outDir`. Corrigido para respeitar a saída configurada, incluindo manifesto, referências e service worker. Uma regressão executa um build real em diretório temporário.
- A abertura mobile repetia seleção de contexto e filtro. O contexto continua disponível no diálogo de filtros; a ação principal foi aproximada do título. Rotas, gráficos e módulos preservados.
- Falha de pagamentos limpava a lista, mas conservava a contagem antiga. Agora a contagem fica “Não confirmado”; histórico incompleto não aparece como confirmado.
- A homologação recebe aviso discreto e `noindex`; o build normal não recebe esse aviso.

## Ambiente isolado

| Recurso | Identificação |
|---|---|
| Projeto financeiro | `frosty-star-45149603` |
| Banco de homologação | `br-divine-surf-acxsimxp` |
| Auth e Data API | `ep-restless-sun-ac1mso3m` |
| Projeto API | `soft-lab-98397625` |
| API de homologação | `br-falling-grass-a5lyf8ed` |
| Contrato | `integrated-finance-v1` |

`release/preview.json` contém somente metadados públicos. A Function conserva suas variáveis existentes; nenhum segredo foi lido, publicado ou alterado. O destino financeiro de produção permanece `ep-damp-meadow-acm7ggxa`.

O primeiro acesso à Function sem compute retornava 404 apesar do deployment concluído. Depois de criar o pequeno endpoint do ramo de API, a URL passou a responder. Isso é uma observação operacional, não uma garantia sobre o ciclo de vida da plataforma.

## Validação executada

- Lint, TypeScript e build aprovados.
- **241 testes unitários** aprovados, cinco novos nesta rodada.
- **206 cenários Chromium** aprovados integralmente, três novos. Após o aviso exclusivo de homologação, cinco cenários de abertura/PWA foram repetidos e aprovados.
- **Seis grupos de integração nativa**: Auth/JWT, RLS de não membro, despesas idempotentes concorrentes, conflito de payload, rejeição de fração de centavo, editar/excluir, acerto idempotente, limite de pagamento, não inflação de gastos, Cofre privado e módulos existentes.
- **Nove grupos pelo frontend com backend real**: login/foco, cadastro com reload, edição/exclusão, pagamento, Cofre, streaming/histórico, sair do assistente, logout e visão inversa dos saldos entre os participantes.
- **Cinco combinações nativas**: Chromium 320/768/1440 e WebKit 390/768, fuso America/Porto_Velho. Filtros, modais, gráficos, erro 503 controlado e recuperação, navegação e ausência de overflow/erro JavaScript.

Fixtures identificadas como QA em novembro de 2001. Base: R$360 em despesas; após os pagamentos de teste, PH deve R$35 em Dinheiro e tem R$30 a receber em Vale. Os métodos permanecem separados. O Cofre de PH não pode ser lido pela outra conta.

Uma execução intermediária de WebKit 768 encontrou total zero depois do recarregamento com erro controlado. Não foi possível atribuir causa com os dados daquela execução. Foram acrescentados diagnóstico de período/requisições e captura em falha; repetição isolada e rodada completa de cinco combinações passaram sem relaxar os valores esperados. Isso não permite prometer ausência de falhas intermitentes.

## Limites do teste de IA

Os adaptadores Gemini e DeepSeek foram exercitados com upstream de contrato **explicitamente simulado**, sem chave real ou cobrança. Auth, permissões, leitura dos valores, criptografia, SSE e persistência eram reais. Não confundir esse ensaio com avaliação da qualidade ou disponibilidade dos modelos reais.

O pacote de QA era exclusivo do ambiente isolado, identificado por `health.qaProvider`. A publicação recusa esse sinal. Configurações falsas e conversas simuladas das duas contas sintéticas foram removidas antes da troca pelo pacote normal. O empacotador padrão não contém o simulador.

## Publicação e verificação pública

Código `130472f8312c525ea975356bccb60bb50b079e9b`; prévia versionada: https://paulohaps.github.io/gastos-casa/pr-preview/pr-19-4eac36c/. O sufixo corresponde ao merge SHA usado pelo workflow de pull request, não ao SHA da branch de trabalho.

Backend normal confirmado por HTTP, versão `2026-10-20.1`, deployment **3**. Identidade do pacote: árvore SHA-256 `2c05bb91b63b5cd52f9f1228d6d2b9bdaf81a02526b0cba00960331fd8051cf5`; ZIP `ae5023aa97942a241c61ab6201214bdf9d20fe87eecfaf03bfc1f01b12c35fcc`. O painel informou deployment concluído antes da propagação da URL. Durante esse intervalo o validador recusou o pacote de QA; só houve push ao PR após confirmação HTTP do pacote normal.

Conferência posterior pelo endereço publicado, **sem interceptar arquivos nem API**, aprovada em Chromium e WebKit, 390px: login real, valores exatos, mudança de competência pelo gráfico, retorno ao mês original e caminho acionável para configurar IA sem perda da sessão. A tentativa sem chave retorna HTTP 409/`AI_NOT_CONFIGURED`; nenhuma chamada paga é feita.

CI de código: **39367182803 aprovada integralmente**, com 241 unitários, 206 cenários Chromium e 12 grupos PostgreSQL. Workflow de prévia `39367182835` e Pages `39367206765` aprovados.

Limpeza concluída: contagem por IDs rastreados confirmou **zero** gastos, acertos, despesas pessoais e carteiras sintéticas. Configurações de IA e conversas dos IDs de QA também zeradas. Consulta específica ao banco pai confirmou zero desses IDs financeiros e zero identidades Auth de QA; não houve escrita em produção. Os dois membros gerados foram desativados e o acesso à Casa negado/lista vazia foi conferido. Sessões iniciais encerradas; contextos de navegador fechados. As identidades sintéticas/referências e o ledger são conservados por integridade; não foram apagados registros de confirmação financeira.

## Arquivos e preservação

- Interface: `Overview.tsx`, `FilterBar.tsx`, `css/workspace.css`, `js/modules/settlements.js`.
- Ambiente e entrega: `backend/runtime-config.mjs`, `backend/index.mjs`, `release/preview.json`, `.github/workflows/pr-preview.yml`, `scripts/validate-preview.mjs`, `vite.config.mjs`, `scripts/package-backend.py`, `index.html`, `sw.js`.
- Regressões: `tests/runtime-config.test.mjs`, `tests/build-output.test.mjs`, `tests/provider-contract.test.mjs`, `tests/integrated-experience.spec.mjs`.
- Ensaio rastreável: `scripts/e2e/` contém criação privada de fixture, API, navegador, compatibilidade, verificação do pacote normal e limpeza por IDs. Nunca versionar o arquivo de sessão gerado; ele contém credenciais sintéticas. Nesta execução ficou fora do repositório, com modo 0600.

Nenhum componente financeiro foi reescrito. Não houve mudança de schema nem necessidade de novo contrato de backend; foram alinhados deploy e destinos dos contratos existentes. Histórico, Cofre, assistente, regras de centavos, idempotência e permissões preservados.

Produção permanece frontend `prod-b84274b994c5`, backend `2026-10-17.3`, deployment 28. Não houve merge, migração ou promoção de produção. Safari físico e chamadas a provedores reais continuam pendentes. A próxima prioridade é validar a experiência integrada com o usuário antes de acrescentar funcionalidades.
