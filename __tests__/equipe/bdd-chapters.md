# BDD — Equipe / Chapters

**Como** membro da equipe  
**Quero** ver e agendar chapters com tema, data e autores  
**Para que** o time organize encontros e materiais com rastreabilidade

## Critérios de aceite

- Tabela no mesmo padrão visual da aba Horários (card, borda, scroll horizontal em mobile).
- Colunas: Edição (1 = data mais antiga), Data (ordem decrescente), Tema, Autor(es), link externo.
- Busca única filtra por texto em Tema ou nomes de autores (sem outros filtros).
- Botão "Agendar Chapter" exibe ícone à esquerda do rótulo (mesmo padrão visual dos botões primários com ícone nas demais telas).
- Botão "Agendar Chapter" abre modal: Tema obrigatório (≤240), Autor(es) obrigatório (≥1, multi), Data obrigatória (somente quintas-feiras, ≥ hoje em America/Sao_Paulo).
- Ícone de hyperlink: abre nova aba se URL válida; desabilitado se vazio ou inválido.
- Administrador: menu "mais" com Editar e Remover; Remover sempre com modal de confirmação.
- Editar: pode alterar Tema, Autores, Data (mesmas regras de quinta + não retroativa exceto manter a data já salva) e Hyperlink.

## Cenário 1 — Listar chapters ordenados

```
Given  existem chapters com datas diferentes
When   abro a aba Chapters em /equipe
Then   as linhas aparecem ordenadas da data mais recente para a mais antiga
And    a coluna Edição numera a partir de 1 na data mais antiga
```

## Cenário 2 — Busca por tema ou autor

```
Given  um chapter com tema "APIs REST" e autores "Ana" e "Bruno"
When   digito "rest" na busca
Then   o chapter é exibido
When   digito "ana"
Then   o chapter é exibido
When   digito "xyz"
Then   nenhum resultado é exibido (ou mensagem de vazio)
```

## Cenário 3 — Agendar com quinta válida

```
Given  estou autenticado
When   clico em Agendar Chapter e preencho tema, pelo menos um autor e uma quinta-feira futura (ou hoje se for quinta)
And    salvo
Then   o chapter aparece na tabela
```

## Cenário 4 — Hyperlink opcional

```
Given  um chapter sem hyperlink
When   visualizo a linha
Then   o ícone de link está desabilitado
Given  um chapter com https válido
When   clico no ícone
Then   uma nova aba abre com a URL
```

## Cenário 5 — Admin remove com confirmação

```
Given  sou Administrador
When   escolho Remover no menu e confirmo no diálogo
Then   o chapter deixa de aparecer na lista
```

## Cenário 6 — Não-admin sem menu de edição

```
Given  sou usuário Padrão
When   visualizo a tabela de chapters
Then   o menu "mais ações" não é exibido
```
