# Tela: Equipe

**Rota:** `/equipe`  
**Acesso:** Todos os usuários autenticados  
**Arquivo:** `src/app/(protected)/equipe/`  
**Server Actions:** `src/features/equipe/actions/equipe-chapters.ts`

## Descrição

Gerencia os Chapters da equipe — encontros semanais de compartilhamento de conhecimento. Inclui calendário de quintas-feiras (America/Sao_Paulo), avaliação por estrelas e ranking de autores.

## Funcionalidades

- **Listagem de chapters** — data, tema, autores, hiperlink, média de avaliação
- **Criar chapter** — data (quintas-feiras do Brazil TZ), tema, autores, hiperlink opcional
- **Editar chapter** — admin apenas
- **Remover chapter** — hard-delete (admin)
- **Avaliar chapter** — 0–5 estrelas (upsert por usuário)
- **Ranking de autores** — paginado, ordenado por número de chapters

## Regras de negócio

- Datas válidas: qualquer data civil (edição) ou quintas-feiras do calendário Brazil (criação)
- Hiperlink: deve ser URL válida se preenchido
- Autores: pelo menos 1 autor ativo obrigatório
- Avaliação: upsert — reavaliação atualiza nota existente, não duplica

## Utilitários

- `src/features/equipe/lib/equipe-chapter-dates.ts` — validação de datas no timezone America/Sao_Paulo

## RBAC

- `can(role, 'menu.equipe')` — visibilidade
- Criar/remover/editar: apenas admin
- Avaliar: todos os usuários autenticados
