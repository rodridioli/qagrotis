# BDD — Configurações: Usuários · Sistemas · Módulos · Clientes · Integrações

## Feature: Configurações / Usuários

**Como** administrador
**Quero** gerenciar usuários do sistema
**Para que** eu possa controlar quem tem acesso e com qual perfil

### Cenário 1 — Criar usuário com dados válidos
```
Given  sou administrador autenticado
When   acesso /configuracoes/usuarios/novo
And    preencho Nome, E-mail e Senha válidos
And   clico em "Salvar"
Then   o usuário é criado com status ativo
And    um toast de sucesso é exibido
And    sou redirecionado para /configuracoes/usuarios
```

### Cenário 2 — Criar usuário com e-mail duplicado
```
Given  sou administrador autenticado
And    já existe um usuário com email "joao@empresa.com"
When   tento criar outro usuário com o mesmo e-mail
Then   um toast de erro é exibido
And    nenhum usuário duplicado é criado (P2002 tratado)
```

### Cenário 3 — Inativar último administrador ativo
```
Given  existe apenas 1 administrador ativo no sistema
When   tento inativar esse administrador
Then   o botão "Inativar" está desabilitado para esse usuário
And    nenhuma ação de inativação é disparada
```

### Cenário 4 — Inativar múltiplos usuários em lote
```
Given  existem 3 usuários ativos selecionados via checkbox
When   clico em "Inativar" no bulk action
And    confirmo no diálogo de confirmação
Then   os 3 usuários são inativados
And    toast exibe "3 usuários inativados com sucesso."
```

### Cenário 5 — Usuário padrão não vê checkboxes
```
Given  sou usuário autenticado com tipo "Padrão"
When   acesso /configuracoes/usuarios
Then   a coluna de checkboxes NÃO é exibida
And    o botão "Inativar" em lote NÃO é exibido
And    o botão "Adicionar Usuário" NÃO é exibido
```

### Cenário 6 — Campos desabilitados durante submit
```
Given  estou no formulário de novo usuário
When   clico em "Salvar" e a requisição está em andamento (isPending)
Then   todos os campos estão desabilitados
And    o botão exibe "Salvando…"
And    não é possível submeter o formulário novamente
```

### Cenário 7 — Formato Híbrido exibe dias da semana
```
Given  estou em /configuracoes/usuarios/novo ou na edição de um usuário
When   seleciono "Híbrido" no campo Formato
Then   logo abaixo aparece o bloco "Dias presenciais (híbrido)" com checkboxes para cada dia da semana (mobile-first, área tocável adequada)
And    cada checkbox tem rótulo acessível com o nome do dia
```

### Cenário 8 — Formato diferente de Híbrido oculta dias
```
Given  o bloco de dias híbridos está visível
When   altero o Formato para "Presencial" ou "Remoto"
Then   o bloco de dias deixa de ser exibido
And    a seleção de dias em memória é limpa para não reenviar dados obsoletos
```

### Cenário 9 — Persistência dos dias em modo Híbrido
```
Given  seleciono Formato "Híbrido" e marco Segunda-feira e Quarta-feira
When   salvo o cadastro
Then   ao reabrir a edição do mesmo usuário o Formato continua "Híbrido"
And    Segunda-feira e Quarta-feira permanecem marcadas
```

---

## Feature: Configurações / Sistemas

### Cenário 1 — Criar sistema com nome válido
```
Given  sou administrador autenticado
When   acesso /configuracoes/sistemas/novo
And    preencho Nome
And    clico em "Salvar"
Then   o sistema é criado com status ativo
And    toast de sucesso é exibido
And    sou redirecionado para /configuracoes/sistemas
```

### Cenário 2 — Tentar criar sistema com nome em branco
```
Given  sou administrador autenticado
When   clico em "Salvar" sem preencher o Nome
Then   toast de erro "O nome é obrigatório." é exibido
And    nenhuma chamada à API é feita
```

### Cenário 3 — Exibir módulos associados
```
Given  um sistema tem 3 módulos ativos
When   visualizo a linha desse sistema na tabela
Then   a coluna "Módulos" exibe "3" como link clicável
When   clico no número
Then   um modal lista os 3 módulos com nome e código
```

### Cenário 4 — Inativar sistema em lote
```
Given  2 sistemas estão selecionados
When   confirmo a inativação
Then   ambos são inativados
And    seus módulos ainda existem no banco (não excluídos)
```

---

## Feature: Configurações / Módulos

### Cenário 1 — Criar módulo sem sistema cadastrado
```
Given  não existe nenhum sistema ativo
When   acesso /configuracoes/modulos/novo
Then   um toast de aviso é exibido: "É preciso cadastrar um sistema antes..."
And    o select de sistema está desabilitado
And    o botão "Salvar" não dispara a ação se o sistema não estiver selecionado
```

### Cenário 2 — Criar módulo com sistema válido
```
Given  existe pelo menos 1 sistema ativo
When   seleciono o sistema, preencho Nome e clico em "Salvar"
Then   o módulo é criado associado ao sistema
And    o contador na tela de sistemas é incrementado
```

### Cenário 3 — Exibir cenários associados
```
Given  um módulo tem 5 cenários ativos
When   visualizo a coluna "Cenários" na tabela de módulos
Then   exibe "5"
```

---

## Feature: Configurações / Clientes

### Cenário 1 — Criar cliente com CPF válido
```
Given  sou administrador autenticado
When   abro o modal "Adicionar Cliente"
And    preencho Nome Fantasia e CPF "529.982.247-25" (válido)
And    clico em "Salvar"
Then   o cliente é criado com sucesso
```

### Cenário 2 — Criar cliente com CPF inválido
```
Given  sou administrador autenticado
When   preencho CPF "111.111.111-11" (dígito verificador inválido)
And    clico em "Salvar"
Then   toast de erro "CPF ou CNPJ inválido." é exibido
And    nenhum cliente é criado
```

### Cenário 3 — Criar cliente com CNPJ válido
```
Given  sou administrador autenticado
When   preencho CNPJ "11.222.333/0001-81" (válido)
And    clico em "Salvar"
Then   o cliente é criado com sucesso
```

### Cenário 4 — Criar cliente sem Nome Fantasia
```
Given  sou administrador autenticado
When   deixo Nome Fantasia em branco e clico em "Salvar"
Then   toast "O Nome Fantasia é obrigatório." é exibido
```

### Cenário 5 — Criar cliente via page /novo (acesso admin)
```
Given  sou usuário padrão (não admin)
When   acesso /configuracoes/clientes/novo diretamente
Then   sou redirecionado para /configuracoes/clientes
```

---

## Feature: Configurações / Integrações

### Cenário 1 — Criar integração com API Key válida
```
Given  sou administrador autenticado
When   acesso /configuracoes/integracoes/novo
And    seleciono provedor, modelo e insiro API Key válida
And    verifico a conexão (ShieldCheck) — status "valid"
And    clico em "Salvar"
Then   a integração é criada com status ativo
And    toast de sucesso é exibido
```

### Cenário 2 — Criar integração com API Key inválida
```
Given  insiro uma API Key inválida
When   clico em verificar conexão
Then   o status muda para "invalid"
And    mensagem "Chave inválida" é exibida
And    posso ainda tentar salvar (não bloqueio forçado)
```

### Cenário 3 — Verificar conexão com JSON inválido na resposta
```
Given  a API externa retorna uma resposta não-JSON em caso de erro
When   clico em verificar conexão
Then   o status muda para "uncertain" (sem crash do servidor)
And    a rota /api/integracoes/validate retorna 422 ou 401 normalmente
```

### Cenário 4 — Campos desabilitados durante submit
```
Given  estou no formulário de nova integração
When   clico em "Salvar" e a requisição está em andamento
Then   Provedor, Modelo e API Key ficam desabilitados
And    o botão "Salvar" exibe "Salvando…"
```

---

## Critérios de Aceite Globais (todos os módulos)

- [ ] Campos de formulário desabilitados durante `isPending`
- [ ] Estados vazios exibidos quando lista está vazia
- [ ] Todos os botões icon-only têm `aria-label` descritivo
- [ ] Tokens do Design System usados (sem hex hardcoded)
- [ ] CPF/CNPJ validado por dígito verificador antes de enviar
- [ ] Admin check na rota `/novo` de Clientes
- [ ] JSON.parse em API routes protegido contra exceções
