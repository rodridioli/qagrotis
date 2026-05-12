# Tela: Feedbacks

**Rota:** `/feedbacks`  
**Acesso:** Todos os usuários autenticados (escrita apenas Admin MGR)  
**Arquivo:** `src/app/(protected)/feedbacks/`

## Descrição

Lista feedbacks registrados pela equipe. Admin MGR pode criar feedbacks para qualquer colaborador.

## Tipos de Feedback

| Tipo | Constante | Campos específicos |
|------|-----------|-------------------|
| Positivo | `POSITIVO` | Descrição |
| Construtivo | `CONSTRUTIVO` | Descrição, ponto de melhoria |
| 360° | `TREZENTOS_SESSENTA` | Descrição, dimensões avaliadas |

## Estados

| Estado | Comportamento |
|--------|--------------|
| Loading | Skeleton de lista via `loading.tsx` |
| Vazio | `EmptyState` com mensagem contextual |
| Com dados | Lista de feedbacks com tipo, autor, data |
| Erro | `error.tsx` com reset |

## RBAC

- `can(role, 'menu.feedbacks')` — visibilidade no menu
- Criar feedback: apenas Admin MGR (`accessProfile === "MGR"`)
- Visualizar feedback: próprio usuário ou Admin MGR

## Rotas relacionadas

- `/individual/feedbacks/nova` — criar feedback
- `/individual/feedbacks/[feedbackId]` — detalhe do feedback
- `/individual/meus-feedbacks/[feedbackId]` — feedback recebido pelo usuário logado
