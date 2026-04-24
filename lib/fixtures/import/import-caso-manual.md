**Cenário:** Teste de exemplo \[IMPORTAÇÃO 1]

**Descrição:** Descrição do cenário de exemplo

**Regra de negócio**: Detalhamento da regra de negócio do exemplo

**Pré-condições**:

\- Feature flag de emissão de RA habilitada para Cocapec

\- Usuário autenticado com perfil de Vendedor

\- Pedido de venda criado contendo ao menos um item controlado (com Código MAPA)

\- Fluxo BPM configurado para aprovação de pedidos



**BDD (Gherkin)**:

DADO que o usuário esteja executando uma ação..

E esta ação exija...

QUANDO ele clicar...

ENTÃO o sistema deve alterar...

E bloquear a ação..



**Resultado esperado:**

\- Status do pedido alterado para "Agd. Receita"

\- Botão "Confirmar Pedido" redireciona para aba Receitas ao ser clicado

\- Toast/mensagem explicando a necessidade de emitir receita exibida

\- Aba "Receitas" habilitada para acesso
