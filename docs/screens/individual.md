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

Drawer lateral (`Sheet side="right"`, `sm:max-w-md`) montado pelo `LayoutClient` quando há avaliação pendente. Não bloqueia a aplicação — o restante da tela permanece visível ao fundo.

**Componentes:**
- `src/features/individual/components/DominioResponderSheet.tsx` — drawer de preenchimento (usuário avaliado)
- `src/features/individual/components/DominioVisualizarSheet.tsx` — drawer de visualização read-only (MGR e usuário, avaliações já concluídas)
- `src/features/individual/components/DominioAvaliacaoModal.tsx` — modal multi-step legado (mantido, não mais montado no LayoutClient)

**Actions:**
- `getPendingDominioAvaliacao()` — busca avaliação pendente + respostas da avaliação CONCLUIDA mais recente (`respostasAnteriores`); ambas as queries filtram por `session.user.id` (IDOR guard)
- `completarDominioAvaliacao(id, respostas[])` — salva respostas; valida via Zod; verifica `evaluatedUserId === session.user.id` (IDOR guard)

**Fluxo (DominioResponderSheet):**
1. Drawer abre automaticamente via `drawerOpen` state no `LayoutClient`
2. Estado inicial de respostas: `buildInitialRespostas(configSnapshot, respostasAnteriores)` — pré-preenche módulos que existem no snapshot atual com notas da avaliação anterior; módulos novos iniciam sem nota
3. Todos os produtos visíveis de uma vez em cards expansíveis (default: expandidos)
4. Cada módulo tem 5 estrelas interativas (1–5); Média Geral e barras de produto atualizam em real-time
5. Botão "Enviar Avaliação" habilitado somente quando todos os módulos têm nota
6. Fechar via X ou backdrop → `ConfirmDialog` ("Sair mesmo assim?") antes de fechar
7. Envio bem-sucedido: `toast.success` + drawer fecha + `router.refresh()` em background

**Cálculo:** média de médias por produto (idêntico ao `calcResultado` do backend em `individual-dominio.ts`)

**Estados:**
- Vazio (nenhuma estrela, sem avaliação anterior): Média Geral 0%, botão desabilitado, footer mostra "X módulos restantes"
- Pré-preenchido completo (avaliação anterior cobre todos os módulos atuais): botão imediatamente habilitado, footer "Pronto para enviar"
- Pré-preenchido parcial (módulos novos sem nota anterior): botão desabilitado até módulos pendentes serem preenchidos
- Parcial: Média Geral calculada em real-time, botão ainda desabilitado
- Completo: footer "Pronto para enviar", botão habilitado
- Enviando: botão "Enviando…" desabilitado
- Erro: `toast.error`, drawer permanece aberto com respostas preservadas
- Fechar sem enviar: `ConfirmDialog` — avaliação permanece PENDENTE no banco

**Indicador de tendência (tabela de avaliações):** comparação com a avaliação CONCLUIDA imediatamente anterior — seta verde (↑) se subiu, seta vermelha (↓) se desceu, nenhum indicador se igual ou se for a primeira avaliação.

**Tooltips:** nomes de produto e módulo com `truncate` exibem o nome completo via `Tooltip` do Design System (em ambos `DominioResponderSheet` e `DominioVisualizarSheet`).

**Acessibilidade:** `role="radiogroup"` + `role="radio"` + `aria-checked` nas estrelas; `aria-expanded` nos cards de produto; `aria-label="Fechar"` no botão X.

## RBAC

- `can(role, 'menu.individual')` — visibilidade do menu
- `can(role, 'individual.view-others')` — ver dados de outro usuário (Admin MGR)
- Usuário Padrão: vê apenas próprios dados
