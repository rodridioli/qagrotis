<!-- gerado por: reviewer | atualizado: 2026-05-29 -->
# Ausências

## Objetivo

Permite que qualquer usuário autenticado registre solicitações de ausência (Falta, Banco de Horas, Atestado, Outro) com intervalo de datas (início e fim). Cada solicitação passa por um fluxo de aprovação exclusivo do Administrador:MGR antes de ser exibida publicamente.

---

## Perfis com Acesso e Regras de Negócio

| Perfil | Individual → Ausências | Equipe → Ausências |
|---|---|---|
| Padrão / Admin QA, UX, TW | Vê próprias ausências **APROVADA** e **RECUSADA**. Pode criar novas. Sem editar/remover. | Vê ausências **APROVADA** de todos. Somente leitura. |
| Administrador:MGR | Vê **todas** as situações (PENDENTE, APROVADA, RECUSADA) do usuário avaliado. Pode aprovar, recusar (com motivo obrigatório), editar e remover. | Idem ao padrão — somente leitura. |

**Regras críticas:**
- Solicitação criada com `situacao=PENDENTE` — **não aparece** na listagem do usuário até ser aprovada.
- Apenas o Administrador:MGR pode transitar `PENDENTE → APROVADA` ou `PENDENTE → RECUSADA`.
- Ao recusar, o MGR deve informar o motivo; o usuário recebe notificação com o texto exato.
- O código `AUS-XXX` é único por usuário (ex: AUS-001, AUS-002).
- Uma ausência pode abranger múltiplos dias (`dataInicio` até `dataFim`). Se ambas forem iguais, representa um único dia.

---

## Banco de Dados

### Model `IndividualAusencias`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `evaluatedUserId` | `String` | FK → CreatedUser |
| `createdByUserId` | `String` | FK → CreatedUser (quem criou) |
| `codigo` | `Int` | Sequencial por usuário (@@unique com evaluatedUserId) |
| `tipo` | `AusenciaTipo` | FALTA, BANCO_HORAS, ATESTADO, ATRASO, OUTRO |
| `dataInicio` | `DateTime` | Data de início da ausência (UTC) |
| `dataFim` | `DateTime` | Data de término da ausência (UTC) |
| `justificativa` | `String` | Texto livre (máx 2000 chars) |
| `situacao` | `AusenciaSituacao` | PENDENTE (default), APROVADA, RECUSADA |
| `motivoRecusa` | `String?` | Preenchido pelo MGR ao recusar |
| `aprovadoPorId` | `String?` | userId do MGR que processou |
| `createdAt` | `DateTime` | Auto |
| `updatedAt` | `DateTime` | Auto (atualizado manualmente nas mutations) |

**Índices:** `evaluatedUserId`, `situacao`, unique `(evaluatedUserId, codigo)`

### Enums

```prisma
enum AusenciaTipo     { FALTA  BANCO_HORAS  ATESTADO  ATRASO  OUTRO }
enum AusenciaSituacao { PENDENTE  APROVADA  RECUSADA }
```

### Efeito colateral — Notificações

| Evento | Destinatário | Tipo | Mensagem |
|---|---|---|---|
| Nova solicitação | Todos os Administrador:MGR | `ABSENCE_REQUEST` | "{Nome} solicitou ausência do tipo {Tipo} em {dd/MM/yyyy}." |
| Solicitação recusada | Usuário solicitante | `ABSENCE_REQUEST` | "Sua solicitação de {Tipo} em {dd/MM/yyyy} foi recusada. Motivo: {motivo}" |

---

## Server Actions

**Arquivo:** `src/features/individual/actions/individual-ausencias.ts`

| Action | Auth | Descrição |
|---|---|---|
| `listIndividualAusencias(evaluatedUserId)` | Autenticado | Lista ausências. Não-MGR: só APROVADA/RECUSADA do próprio usuário. MGR: todas as situações de qualquer usuário. |
| `listAllAusenciasAprovadas()` | Autenticado | Somente APROVADA de todos os usuários. Ordenado por `dataInicio` desc. |
| `createIndividualAusencias(input)` | Autenticado | Cria com PENDENTE. Não-MGR só pode criar para si mesmo. Notifica MGRs. |
| `approveIndividualAusencias(id)` | MGR | PENDENTE → APROVADA. Idempotência: rejeita se já processada. |
| `refuseIndividualAusencias(input)` | MGR | PENDENTE → RECUSADA + motivo. Notifica solicitante. |
| `updateIndividualAusencias(input)` | MGR | Atualiza tipo, dataInicio, dataFim e justificativa. |
| `deleteIndividualAusencias(id)` | MGR | Hard-delete. |

**Zod schemas exportados** (reutilizados pelo front-end):
- `createAusenciaSchema` — inclui `evaluatedUserId`, `tipo`, `dataInicioIso`, `dataFimIso`, `justificativa`. superRefine: `dataFimIso >= dataInicioIso`
- `updateAusenciaSchema` — mesmos campos + `id`
- `refuseAusenciaSchema` — `{ id, motivoRecusa: min(1) }`

---

## Componentes Front-end

| Componente | Caminho | Uso |
|---|---|---|
| `IndividualAusenciasSection` | `src/features/individual/components/` | CRUD completo. Props: `evaluatedUserId`, `canWrite`. Exporta handle `openAdd()`. |
| `EquipeAusenciasSection` | `src/features/equipe/components/` | Somente leitura + criação. Props: `isMgr`, `currentUserId`. |
| `AusenciaSituacaoBadge` | `src/components/shared/StatusBadge.tsx` | Badge clicável quando `situacao=RECUSADA` + `onClick` passado. |
| `AusenciaTipoBadge` | `src/components/shared/StatusBadge.tsx` | Badge de tipo com cor semântica. |

### Colunas das tabelas

**Individual (`/individual/ausencias`):**
`Código | Usuário | Tipo | Período | Justificativa | Situação | Ações`

**Equipe (`/equipe?tab=ausencias`):**
`Período | Usuário | Tipo | Justificativa`

A coluna **Período** exibe `"DD/MM/YYYY – DD/MM/YYYY"` para intervalos multi-dia ou `"DD/MM/YYYY"` para ausências de um único dia.

A tabela de Equipe filtra por `dataFim >= hoje` (mostra apenas ausências em andamento ou futuras) e ordena por `dataInicio` crescente.

### Modais do `IndividualAusenciasSection`

| Modal | Quem vê | Trigger |
|---|---|---|
| Informar / Editar ausência | Todos / MGR | Botão "+ Informar ausência" ou clique no código (MGR) |
| Motivo da recusa (read-only) | Qualquer usuário com ausência RECUSADA | Clique no badge "Recusada" |
| Recusar solicitação | MGR | Botão "Recusar" na linha PENDENTE |
| Confirmar remoção | MGR | Opção "Remover" no DropdownMenu |

---

## Fluxos e Validações

### Criar solicitação

1. Usuário preenche tipo, data de início, data de término, justificativa
2. Validação client-side: campos obrigatórios + dataFim ≥ dataInicio
3. Validação server-side: `createAusenciaSchema` + ownership check
4. Criado com PENDENTE — não aparece na listagem do usuário
5. Todos os MGRs recebem notificação `ABSENCE_REQUEST`

### Aprovação/Recusa pelo MGR

- **Aprovar:** atualiza situacao=APROVADA + aprovadoPorId
- **Recusar:** `motivoRecusa` obrigatório (min 1 char) → situacao=RECUSADA → notificação ao solicitante
- Ambas rejeitam se `situacao !== PENDENTE` (proteção contra duplo processamento)

### Mensagens de feedback (toasts)

| Ação | Toast |
|---|---|
| Criação | "Solicitação enviada para aprovação." |
| Aprovação | "Ausência aprovada com sucesso." |
| Recusa | "Solicitação recusada. O usuário foi notificado." |
| Edição | "Ausência atualizada com sucesso." |
| Remoção | "Ausência removida." |
| Erro genérico | "Algo deu errado. Tente novamente." |

### Mensagens de erro de validação

| Campo | Mensagem |
|---|---|
| Campo obrigatório vazio | toast.error("Preencha todos os campos obrigatórios.") + border-destructive |
| dataFim < dataInicio | Erro inline abaixo do campo: "A data de término deve ser igual ou posterior à data de início." |
| Motivo de recusa vazio | toast.error("Preencha todos os campos obrigatórios.") + border-destructive |

---

## Garantia de Schema (sem migrations)

A função `ensureIndividualAusenciasTable()` em `src/core/prisma-schema-ensure.ts` cria e evolui a tabela de forma idempotente:
- Tipos Postgres `AusenciaTipo` e `AusenciaSituacao` via `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`
- Adiciona `ATRASO` ao enum `AusenciaTipo` via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`
- Tabela `IndividualAusencias` via `CREATE TABLE IF NOT EXISTS` com `dataInicio` e `dataFim`
- Para DBs existentes: `ADD COLUMN IF NOT EXISTS` para `dataInicio`/`dataFim`, migra dados de `data` → ambas as colunas, remove colunas obsoletas (`data`, `diaInteiro`, `horaInicio`, `horaFim`) via `DROP COLUMN IF EXISTS`
- 3 índices idempotentes

Chamada no início de cada Server Action antes de qualquer query.
