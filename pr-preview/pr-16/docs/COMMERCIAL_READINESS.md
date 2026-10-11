# Prontidão para escala comercial

Este documento registra o que já está preparado para evoluir o projeto pessoal para um produto multiusuário e o que ainda precisa mudar antes de oferecer o sistema a terceiros.

## O que já ajuda na escala

- Frontend PWA desacoplado do backend.
- Backend com contratos explícitos e autenticação.
- RLS no PostgreSQL.
- Smart Entry separado do fluxo de gravação de gastos.
- Feature flags para funcionalidades inteligentes.
- Telemetria de qualidade sem texto bruto.
- Testes unitários, contratos e smoke visual em múltiplos viewports.
- Componentes visuais e tokens consolidados.
- Regras inteligentes e templates de descrição centralizados.

## Bloqueadores para uso comercial

### 1. Multi-tenancy real

O sistema atual representa uma única casa. Para uso comercial deve existir uma entidade `households` (ou `workspaces`) e todas as tabelas financeiras precisam carregar `household_id`.

A regra de isolamento deve ser aplicada no banco, não apenas no frontend.

Estrutura-alvo:

```
households
household_members
gastos
orcamentos
gastos_recorrentes
smart_entry_rules
smart_entry_telemetry
```

Cada registro de negócio deve pertencer explicitamente a um `household_id`.

### 2. Papéis e permissões

Hoje um membro autorizado tem capacidades amplas. Antes de escalar, separar no mínimo:

- owner;
- admin;
- member.

Criação de usuários, regras globais e futuras configurações de cobrança devem ficar restritas a owner/admin.

### 3. Parametrização por casa

As categorias, formas de pagamento e regra de divisão ainda são conceitos do produto atual. Para clientes externos devem virar configuração por household, com defaults seguros.

### 4. Onboarding

Produto comercial precisa permitir:

- criar uma nova casa;
- convidar membros;
- aceitar convite;
- definir regra de divisão;
- escolher categorias;
- concluir configuração inicial.

### 5. Segurança e privacidade

Antes de disponibilização pública:

- rate limit por usuário/household;
- política de retenção da telemetria;
- auditoria de ações administrativas;
- exportação e exclusão de dados;
- revisão LGPD/termos;
- política de backups e restauração;
- rotação e gestão de secrets.

### 6. Operação do produto

Adicionar observabilidade por tenant sem expor conteúdo financeiro:

- erros por endpoint;
- latência;
- taxa de sucesso;
- versão de frontend/backend;
- uso do Smart Entry;
- falhas de autenticação;
- migrations aplicadas.

## Estratégia de migração sem quebrar o app atual

1. criar `households` e associar a casa atual;
2. adicionar `household_id` de forma aditiva;
3. preencher registros existentes;
4. criar índices e novas policies RLS;
5. mudar endpoints para filtrar por household autenticado;
6. validar dupla leitura;
7. tornar `household_id` obrigatório;
8. só então habilitar criação de novas casas.

Não fazer uma migração destrutiva direta.

## Smart Entry em escala

A inteligência deve continuar seguindo:

```
regra manual do household
→ aprendizado confirmado do household
→ heurística do sistema
→ histórico do household
→ IA opcional para ambiguidade
→ revisão humana
```

Nenhum aprendizado deve atravessar tenants.

## Critério antes de comercializar

Não considerar pronto para terceiros até existirem:

- isolamento multi-tenant validado por testes;
- owner/admin/member;
- onboarding e convite;
- parametrização de divisão;
- política de backup/restore;
- rate limiting;
- auditoria;
- testes de segurança e RLS entre tenants.
