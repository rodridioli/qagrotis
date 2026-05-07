# Documentação de Testes - Simulador de Preços

## Ambiente e Dados de Teste

### URL do Sistema

- **Ambiente de QA:** `https://hom-testesautomatizados.agrotis.io/`

### Massa de Dados: Credenciais

| Perfil        | Login                              | Senha         |
| ------------- | ---------------------------------- | ------------- |
| **Automação** | `gustavo.moreira+auto@agrotis.com` | `Agrotis*123` |

### Massa de Dados: Simulador (filtros e item)

| Campo                     | Valor                                                          |
| ------------------------- | -------------------------------------------------------------- |
| **Filial**                | `Agrotis Receitas Agronômicas`                                 |
| **Cliente**               | `Cliente Robot Permanente`                                     |
| **UF**                    | `MG` (ajustar se o parceiro carregar outra UF automaticamente) |
| **Tipo de Operação**      | `5102-Venda Merc.`                                             |
| **Tipo de Negociação**    | `PADRÃO`                                                       |
| **Condição de Pagamento** | `Livre` (ou valor pré-carregado pela configuração do tenant)   |
| **Item (modal)**          | `Item base`                                                    |

**Observações de escopo (implementação atual):**

- A tela **Simulador de Preço** não possui exportação PDF/Excel, salvamento de simulação, frete nem edição de desconto/quantidade na grade de resultados.
- Os preços são obtidos via API `item/precos-lista-item-condicoes-pagamento`; a expansão do acordeão do item consulta estoque (`estoque/listar`).
- O campo **UF** e o **Vendedor** podem ser preenchidos automaticamente após selecionar o cliente.

---

## CT001 - Acessar o Simulador de Preço e validar o formulário

#### **Objetivo**

Validar que o usuário autenticado acessa a rota do simulador, visualiza o título da tela e os campos principais do filtro, além dos botões **Simular** e **Limpar**.

#### **Pré-Condições**

- Sistema online.
- Usuário autenticado com permissão para o Simulador de Preços.

#### **Passos**

| **Id** | **Ação**                                             | **Resultado Esperado**                                                                                                                                                            |
| ------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Acessar o módulo ERP e abrir **Simulador de Preços** | A URL contém `simulador-preco` e o cabeçalho exibe **Simulador de Preço**.                                                                                                        |
| 2      | Verificar campos do filtro                           | Devem estar visíveis: Filial, Cliente, Grupo de Cliente, UF, Vendedor, Tipo de Operação, Tipo de Negociação (quando aplicável), Data de Vencimento, Condição de Pagamento, Itens. |
| 3      | Verificar ações inferiores                           | Checkbox **Manter Histórico de Simulações**, botões **Limpar** e **Simular** visíveis.                                                                                            |

#### **Resultados**

| **Resultado Obtido** | **Status** |
| -------------------- | ---------- |
|                      |            |

---

## CT002 - Validar campos obrigatórios ao clicar em Simular

#### **Objetivo**

Garantir que o formulário não envia a simulação sem os dados obrigatórios e exibe a mensagem de validação adequada.

#### **Pré-Condições**

- Usuário na tela do Simulador de Preço.
- Campos obrigatórios não totalmente preenchidos (ex.: sem Cliente ou sem Itens).

#### **Passos**

| **Id** | **Ação**                         | **Resultado Esperado**                                                           |
| ------ | -------------------------------- | -------------------------------------------------------------------------------- |
| 1      | Garantir que faltam obrigatórios | Ex.: não selecionar Cliente ou não adicionar Itens.                              |
| 2      | Clicar em **Simular**            | O sistema exibe snackbar/alerta: **Por favor, preencha os campos obrigatórios!** |

#### **Resultados**

| **Resultado Obtido** | **Status** |
| -------------------- | ---------- |
|                      |            |

---

## CT003 - Simular preços com sucesso (fluxo principal)

#### **Objetivo**

Validar o fluxo completo: preencher filtros, incluir item pela modal **Itens**, executar **Simular** e exibir a área **Simulações** com preços por condição de pagamento.

#### **Pré-Condições**

- Massa de dados do tenant com cliente, filial, tipos e item válidos para precificação.

#### **Passos**

| **Id** | **Ação**                                                                  | **Resultado Esperado**                                                                                                                 |
| ------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Preencher **Filial**                                                      | Filial selecionada.                                                                                                                    |
| 2      | Preencher **Cliente**                                                     | Cliente selecionado; UF/Vendedor/Grupo podem carregar automaticamente.                                                                 |
| 3      | Ajustar **UF** ou **Vendedor** se necessário                              | Valores coerentes com o endereço do parceiro.                                                                                          |
| 4      | Selecionar **Tipo de Operação** e **Tipo de Negociação** (se obrigatório) | Valores válidos.                                                                                                                       |
| 5      | Informar **Data de Vencimento** válida (formato completo)                 | Data aceita sem erro de validação.                                                                                                     |
| 6      | Selecionar ao menos uma **Condição de Pagamento** (até 3)                 | Condições exibidas no campo.                                                                                                           |
| 7      | Abrir o campo **Itens**, buscar e selecionar item(s) na modal             | Modal **Itens** fecha com itens nos chips do campo.                                                                                    |
| 8      | Clicar em **Simular**                                                     | Snackbar de sucesso: **Preços simulados com sucesso!**                                                                                 |
| 9      | Verificar a área de resultados                                            | Título **Simulações (NN)** com NN igual ao número de linhas retornadas; colunas como **Cond. Pagamento/Preço** com valores monetários. |

#### **Resultados**

| **Resultado Obtido** | **Status** |
| -------------------- | ---------- |
|                      |            |

---

## CT004 - Limpar dados do parceiro e da negociação

#### **Objetivo**

Validar que **Limpar** remove os valores de cliente, grupo, UF, vendedor, tipos de operação/negociação e condições de pagamento conforme implementação, permitindo reiniciar o filtro.

#### **Pré-Condições**

- Filtros preenchidos parcial ou totalmente (exceto o que o reset não limpar).

#### **Passos**

| **Id** | **Ação**                               | **Resultado Esperado**                                                                                                              |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Preencher Cliente, tipos e condições   | Campos preenchidos.                                                                                                                 |
| 2      | Clicar em **Limpar**                   | Cliente, grupo, UF, vendedor, tipo de operação, tipo de negociação e condições são limpos conforme regra da aplicação.              |
| 3      | Verificar seção de simulações anterior | Se havia resultados, o comportamento segue a regra de reset dos multiselects (pode limpar lista de simulações associada ao estado). |

#### **Resultados**

| **Resultado Obtido** | **Status** |
| -------------------- | ---------- |
|                      |            |

---

## CT005 - Manter histórico de simulações

#### **Objetivo**

Validar que, com **Manter Histórico de Simulações** marcado e já existindo resultados, uma nova simulação **acrescenta** linhas na lista; com desmarcado, a nova simulação **substitui** a lista anterior.

#### **Pré-Condições**

- Pelo menos uma simulação já executada com sucesso na sessão.

#### **Passos**

| **Id** | **Ação**                                                     | **Resultado Esperado**                                                               |
| ------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1      | Executar **Simular** com histórico desmarcado                | Lista **Simulações (NN)** com NN correspondente ao retorno atual.                    |
| 2      | Marcar **Manter Histórico de Simulações**                    | Checkbox marcado.                                                                    |
| 3      | Executar **Simular** novamente com os mesmos filtros e itens | NN aumenta (acúmulo de linhas) ou novas linhas aparecem conforme regra de numeração. |
| 4      | Desmarcar histórico e **Simular** de novo                    | Lista substituída pela última execução (sem acúmulo da etapa anterior).              |

#### **Resultados**

| **Resultado Obtido** | **Status** |
| -------------------- | ---------- |
|                      |            |

---

## CT006 - Expandir item e visualizar estoque

#### **Objetivo**

Validar que ao expandir o acordeão de um item simulado o sistema consulta o estoque e exibe a tabela de depósitos ou a mensagem de vazio.

#### **Pré-Condições**

- Simulação concluída com pelo menos um item na lista.

#### **Passos**

| **Id** | **Ação**                       | **Resultado Esperado**                                                                                               |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1      | Clicar para expandir o item    | Indicador de carregamento pode aparecer brevemente.                                                                  |
| 2      | Aguardar o fim do carregamento | É exibida tabela com colunas de estoque (ex.: Em estoque, Disponível) **ou** mensagem **Nenhum estoque encontrado.** |

#### **Resultados**

| **Resultado Obtido** | **Status** |
| -------------------- | ---------- |
|                      |            |

---

## CT007 - Selecionar itens e habilitar Gerar Pedido

#### **Objetivo**

Validar a seleção por checkbox de itens da **mesma** numeração de simulação e o habilitamento do botão **Gerar Pedido**.

#### **Pré-Condições**

- Lista de simulações com ao menos um item sem restrição de venda.

#### **Passos**

| **Id** | **Ação**                                         | **Resultado Esperado**                                                           |
| ------ | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1      | Observar o botão **Gerar Pedido** sem seleção    | Botão desabilitado.                                                              |
| 2      | Marcar o checkbox de um item elegível            | Item selecionado.                                                                |
| 3      | Verificar **Gerar Pedido**                       | Botão habilitado.                                                                |
| 4      | (Opcional) Clicar em **Gerar Pedido** e cancelar | Modal pode ser fechado sem concluir pedido, se desejado evitar massa de pedidos. |

#### **Resultados**

| **Resultado Obtido** | **Status** |
| -------------------- | ---------- |
|                      |            |

---

## CT008 - Item bloqueado para venda (restrição)

#### **Objetivo**

Quando a API de validação indicar restrição de venda, validar o ícone de aviso e o modal informativo.

#### **Pré-Condições**

- Existir item/parceiro que dispare `restricaoVenda` na validação de itens (massa específica do tenant).

#### **Passos**

| **Id** | **Ação**                             | **Resultado Esperado**                                          |
| ------ | ------------------------------------ | --------------------------------------------------------------- |
| 1      | Simular com item sujeito a restrição | Na linha do item aparece ícone de aviso (bloqueado para venda). |
| 2      | Clicar no ícone de aviso             | Modal explicativo é exibido.                                    |
| 3      | Fechar o modal                       | Retorno à lista de simulações.                                  |

#### **Resultados**

| **Resultado Obtido** | **Status** |
| -------------------- | ---------- |
|                      |            |

---

## CT009 - Data de vencimento inválida

#### **Objetivo**

Validar que data incompleta ou inválida impede a simulação e exibe erro no campo.

#### **Pré-Condições**

- Demais campos válidos; foco no campo **Data de Vencimento**.

#### **Passos**

| **Id** | **Ação**                                         | **Resultado Esperado**                                                           |
| ------ | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1      | Alterar a data para valor incompleto ou inválido | Campo em estado inválido.                                                        |
| 2      | Clicar em **Simular**                            | Mensagem **Data inválida!** associada ao campo (validação manual do formulário). |

#### **Resultados**

| **Resultado Obtido** | **Status** |
| -------------------- | ---------- |
|                      |            |

---
