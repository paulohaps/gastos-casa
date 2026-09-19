# Parametrização do Gastos

## Já parametrizado no app
- Usuários da casa: cadastro pelo painel **Configurações > Usuários da casa**.
- Orçamento mensal por categoria.
- Gastos recorrentes.

## Próximas parametrizações
A próxima evolução deve retirar valores fixos do frontend e centralizar estas configurações:

1. **Categorias**
   - nome;
   - ícone;
   - ativo/inativo;
   - ordem;
   - cor apenas quando houver função visual.

2. **Formas de pagamento**
   - nome;
   - tipo;
   - ativo/inativo;
   - regra de acerto quando aplicável.

3. **Regra de divisão**
   - hoje: 50/50;
   - futuro: percentual por membro;
   - vigência por período.

4. **Membros**
   - ativar/desativar acesso;
   - nome de exibição;
   - e-mail;
   - permissões futuras, se necessárias.

5. **Preferências da casa**
   - moeda;
   - início do ciclo financeiro;
   - alertas;
   - limites padrão.

## Regra de arquitetura
Configurações de negócio não devem ser adicionadas como constantes espalhadas em HTML/JS.
Quando uma configuração passar a ser editável, deve ter:
- fonte de verdade no banco;
- endpoint explícito;
- validação no backend;
- RLS/permissão adequada;
- componente único em Configurações;
- fallback seguro no frontend.

A criação de usuários deve sempre exigir uma sessão de membro já autorizado. Cadastro público não concede acesso aos dados da casa.
