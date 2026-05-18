# Tela: Individual

**Rota:** `/individual`  
**Acesso:** Cada usuário vê apenas seus próprios dados; Admin MGR vê todos  
**Arquivo:** `src/app/(protected)/individual/`

## Descrição

Área pessoal do usuário com avaliações de desempenho, feedbacks e progressões de carreira.

## Seções (tabs)

| Seção | Rota | Descrição |
|-------|------|-----------|
| Meu Perfil | `/individual/perfil` | Dados pessoais, formação, horários |
| Minhas Avaliações | `/individual/minhas-avaliacoes` | Avaliações 180° do próprio usuário |
| Meus Feedbacks | `/individual/meus-feedbacks` | Feedbacks recebidos pelo usuário |
| Avaliações | `/individual/avaliacoes` | Admin MGR: ver todas as avaliações |
| Feedbacks | `/individual/feedbacks` | Admin MGR: ver/criar todos os feedbacks |
| Progressões | `/individual/progressoes` | Admin MGR: histórico salarial/PLR |

## Avaliação de Desempenho

- 23 competências com pesos (0,2 a 1,0)
- Score calculado por `computePerformanceScorePercent()` em `src/features/individual/lib/`
- Níveis: Não Atende (0), Parcialmente (1), Em Desenvolvimento (2), Esperado (3), Excelente (4)
- Gera PDF com os resultados

## Feedbacks

- Tipos: Positivo, Construtivo, 360 (TREZENTOS_SESSENTA)
- Feedback 360 tem campos específicos além dos padrões

## Progressões

- Regimes: CLT, PJ, COOPERADO
- Histórico de aumentos/mudanças com data e valor

## Avaliação de Domínio

Fluxo full screen imersivo (100vw × 100vh) montado pelo `LayoutClient` quando há avaliação pendente.

**Componente:** `src/features/individual/components/DominioAvaliacaoModal.tsx`

**Actions:**
- `getPendingDominioAvaliacao()` — busca avaliação pendente do usuário logado (chamada no layout)
- `completarDominioAvaliacao(id, respostas[])` — salva respostas; valida via Zod; verifica `evaluatedUserId === session.user.id` (IDOR guard)

**Fluxo:**
1. Tela abre com fade-in + barra de progresso global no topo
2. Um produto por vez; módulos avaliados com 1–5 estrelas
3. "Próximo →" bloqueado até todos os módulos do produto atual terem nota
4. Slide horizontal entre produtos (250ms ease-in-out)
5. Após o último produto: tela de conclusão com badge animado, pontuação geral e resumo por produto
6. Som de sucesso via Web Audio API (C5→E5→G5, suprimido com `prefers-reduced-motion`)
7. "Confirmar e salvar" chama a action e fecha com fade-out

**Estados:**
- Vazio (`configSnapshot=[]`): ícone PackageX + mensagem orientativa
- Loading: botão "Salvando…" desabilitado
- Erro: `toast.error` via Sonner + tela de conclusão permanece aberta
- Sucesso: `toast.success` + fade-out + `router.refresh()`

**Acessibilidade:** focus trap, `aria-live="polite"` no indicador de step, `role="progressbar"`, Esc abre confirm dialog de saída.

## RBAC

- `can(role, 'menu.individual')` — visibilidade do menu
- `can(role, 'individual.view-others')` — ver dados de outro usuário (Admin MGR)
- Usuário Padrão: vê apenas próprios dados
